# docker build --platform=linux/amd64 -t bazel-build-protos .
# docker run --user bazeluser --platform=linux/amd64 -it bazel-build-protos bash

# bazel build //... --noenable_bzlmod
# ./tools/java/package_proto_jar.sh

FROM ubuntu:22.04 AS base-bazel

ENV BAZEL_VERSION=7.0.0
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    zip \
    unzip \
    openjdk-21-jdk \
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

FROM base-bazel AS user-bazel

# Run as non-root - Required for rules_python
# See: https://github.com/bazelbuild/rules_python/pull/713
# Create group and user
RUN groupadd -r bazeluser && useradd -r -m -g bazeluser bazeluser
RUN mkdir -p /build && \
    chown -R bazeluser:bazeluser /build && \
    chmod -R 777 /build

USER bazeluser
WORKDIR /build

FROM user-bazel AS dev-bazel

# Copy entire repository for convenience
# Invalidate cache for this step
ARG CACHEBUST=1
COPY --chown=bazeluser:bazeluser . .