FROM ubuntu:22.04 AS base-bazel

ENV BAZEL_VERSION=7.0.0
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    zip \
    unzip \
    openjdk-21-jdk \
    maven \
    g++ \
    gcc \
    golang-go \
    python3-pip \
    tree \
    vim \
    && apt-get clean

RUN apt-get install software-properties-common -y
RUN add-apt-repository ppa:deadsnakes/ppa -y
RUN apt-get install python3.10 python3.10-dev -y

RUN curl -fsSL https://github.com/bazelbuild/bazel/releases/download/$BAZEL_VERSION/bazel-$BAZEL_VERSION-installer-linux-x86_64.sh -o bazel-installer.sh \
    && chmod +x bazel-installer.sh \
    && ./bazel-installer.sh \
    && rm bazel-installer.sh

RUN bazel --version

FROM base-bazel AS build-bazel

# Run as non-root - Required for rules_python
# See: https://github.com/bazelbuild/rules_python/pull/713
# Create group and user
RUN groupadd -r bazeluser && useradd -r -m -g bazeluser bazeluser
RUN mkdir -p /build && \
    chown -R bazeluser:bazeluser /build && \
    chmod -R 777 /build

USER bazeluser
WORKDIR /build

# Copy entire repository for convenience
# Invalidate cache to ensure updates are captured
# ARG CACHEBUST=1
COPY --chown=bazeluser:bazeluser . .

#################################################
##### JAVA STAGES ###############################
#################################################

FROM build-bazel AS build-bazel-java

RUN bazel build //:java_protos_all

FROM build-bazel-java AS package-bazel-java

RUN /build/tools/java/package_proto_jar.sh

FROM package-bazel-java AS test-bazel-java

ARG OPENSEARCH_BRANCH=main
ARG PROTO_SNAPSHOT_VERSION=0.4.0

ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH=$PATH:$JAVA_HOME/bin
ENV PUB_ARTIFACTS=/build/generated/maven/publish/

RUN mvn install:install-file \
  -Dfile=${PUB_ARTIFACTS}protobufs-${PROTO_SNAPSHOT_VERSION}-SNAPSHOT.jar \
  -DpomFile=${PUB_ARTIFACTS}protobufs-${PROTO_SNAPSHOT_VERSION}-SNAPSHOT.pom \
  -Dsources=${PUB_ARTIFACTS}protobufs-${PROTO_SNAPSHOT_VERSION}-SNAPSHOT-sources.jar \
  -Djavadoc=${PUB_ARTIFACTS}protobufs-${PROTO_SNAPSHOT_VERSION}-SNAPSHOT-javadoc.jar

RUN git clone --branch ${OPENSEARCH_BRANCH} https://github.com/opensearch-project/OpenSearch.git /build/opensearch

WORKDIR /build/opensearch

# Update transport-grpc/build.gradle to use PROTO_SNAPSHOT_VERSION
RUN sed -i 's/org\.opensearch:protobufs:[0-9]\+\.[0-9]\+\.[0-9]\+/org.opensearch:protobufs:'"${PROTO_SNAPSHOT_VERSION}"'/' /build/opensearch/plugins/transport-grpc/build.gradle

RUN ./gradlew :plugins:transport-grpc:test -Drepos.mavenLocal
RUN ./gradlew :plugins:transport-grpc:internalClusterTest -Drepos.mavenLocal

#################################################
##### PYTHON STAGES #############################
#################################################

FROM build-bazel AS build-bazel-python

RUN bazel build //:python_protos_all

FROM build-bazel-python AS package-bazel-python

RUN bazel build //:opensearch_protos_wheel

FROM package-bazel-python AS test-bazel-python

ARG OPENSEARCH_BRANCH=main

RUN pip3 install protobuf grpcio
RUN pip3 install /build/bazel-bin/opensearch_protos-*-py3-none-any.whl

RUN git clone --branch ${OPENSEARCH_BRANCH} https://github.com/opensearch-project/OpenSearch.git /build/opensearch
WORKDIR /build/opensearch

# Wait for opensearch to build and start
ARG CACHEBUST=1
RUN ./gradlew run -PinstalledPlugins="[\"transport-grpc\"]" -Dtests.opensearch.aux.transport.types="[\"experimental-transport-grpc\"]" &
RUN timeout 300 bash -c 'until curl -s http://localhost:9200 > /dev/null; do echo "Waiting for OpenSearch..."; sleep 2; done || exit 1'

RUN python3 /build/tools/python/test_grpc_client.py

#################################################
##### GO STAGES ##################################
#################################################

FROM build-bazel AS build-bazel-go

RUN bazel build //:go_protos_all

FROM build-bazel-go AS package-bazel-go

# Create a clean directory structure for Go protobuf files
RUN mkdir -p /build/generated/go/opensearchpb && \
    mkdir -p /build/generated/go/services

# Copy generated Go protobuf files
RUN find bazel-bin/protos/schemas -name "*.pb.go" -path "*_go_proto_pb*" -exec cp {} /build/generated/go/opensearchpb/ \; && \
    find bazel-bin/protos/services -name "*.pb.go" -path "*_go_proto_pb*" -exec cp {} /build/generated/go/services/ \; && \
    find bazel-bin/protos/services -name "*_grpc.pb.go" -path "*_go_proto_pb*" -exec cp {} /build/generated/go/services/ \;

FROM package-bazel-go AS test-bazel-go

# Set up Go module and validate generated code
WORKDIR /build/generated/go

# Create go.mod with proper module path
RUN echo 'module github.com/opensearch-project/opensearch-protobufs/go' > go.mod && \
    echo '' >> go.mod && \
    echo 'go 1.19' >> go.mod && \
    echo '' >> go.mod && \
    echo 'require (' >> go.mod && \
    echo '    google.golang.org/protobuf v1.31.0' >> go.mod && \
    echo '    google.golang.org/grpc v1.58.0' >> go.mod && \
    echo ')' >> go.mod

# Test that Go code compiles successfully
RUN go mod tidy && \
    go build ./...
