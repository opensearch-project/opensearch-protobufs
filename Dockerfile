# docker build --no-cache --platform=linux/amd64 -t bazel-5.4.1 .
# docker run --platform=linux/amd64 -it bazel-5.4.1 bash

# BUILD LIBRARIES

# JAVA
# bazel build //protos/schemas:common_java_proto //protos/schemas:document_java_proto //protos/schemas:search_java_proto
# bazel build //protos/services:document_service_grpc_java //protos/services:search_service_grpc_java

# PYTHON
# bazel build //protos/schemas:common_proto_py //protos/schemas:document_proto_py //protos/schemas:search_proto_py
# bazel build //protos/services:document_service_grpc_python //protos/services:search_service_grpc_python

FROM ubuntu:22.04 AS base-bazel

ENV BAZEL_VERSION=5.4.1
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    zip \
    unzip \
    openjdk-21-jdk \
    python3 \
    g++ \
    gcc \
    && apt-get clean

RUN apt-get install software-properties-common -y
RUN add-apt-repository ppa:deadsnakes/ppa -y
RUN apt-get install python3.10 python3.10-dev -y
RUN apt-get install python3-pip

RUN curl -fsSL https://github.com/bazelbuild/bazel/releases/download/$BAZEL_VERSION/bazel-$BAZEL_VERSION-installer-linux-x86_64.sh -o bazel-installer.sh \
    && chmod +x bazel-installer.sh \
    && ./bazel-installer.sh \
    && rm bazel-installer.sh

RUN bazel --version

FROM base-bazel AS build-java

WORKDIR /build

# Copy entire repository for convenience
COPY . .

# RUN bazel build //...