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
ARG CACHEBUST=1
COPY --chown=bazeluser:bazeluser . .

FROM build-bazel AS build-bazel-java

RUN /build/tools/java/package_proto_jar.sh

FROM build-bazel-java AS test-bazel-java

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

RUN git clone --branch ${OPENSEARCH_BRANCH} https://github.com/opensearch-project/OpenSearch.git /opensearch

WORKDIR /opensearch
RUN ./gradlew :plugins:transport-grpc:test
RUN ./gradlew :plugins:transport-grpc:internalClusterTest