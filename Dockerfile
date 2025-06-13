FROM ubuntu:22.04 AS base-bazel

ENV BAZEL_VERSION=8.2.0
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
    sudo \
    && apt-get clean

RUN apt-get install software-properties-common -y
RUN add-apt-repository ppa:deadsnakes/ppa -y
RUN apt-get install python3.10 python3.10-dev -y
RUN apt-get install python3-pip -y
RUN apt-get install protobuf-compiler -y
RUN apt-get install python3-protobuf -y

RUN curl -fsSL https://github.com/bazelbuild/bazel/releases/download/$BAZEL_VERSION/bazel-$BAZEL_VERSION-installer-linux-x86_64.sh -o bazel-installer.sh \
    && chmod +x bazel-installer.sh \
    && ./bazel-installer.sh \
    && rm bazel-installer.sh

RUN bazel --version

FROM base-bazel AS user-bazel

WORKDIR /build

# Run as non-root - Required for rules_python
# See: https://github.com/bazelbuild/rules_python/pull/713
# Create group and user
RUN groupadd -r bazeluser && useradd -r -m -g bazeluser bazeluser
RUN echo "bazeluser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
RUN chown -R bazeluser:bazeluser /build
RUN chown -R bazeluser:bazeluser /home/bazeluser && \
    chmod 755 /home/bazeluser

USER bazeluser

FROM user-bazel AS build-bazel

# Copy entire repository for convenience
# Ensure copy of local repo is not cached 
ARG CACHEBUST=1
COPY . .

FROM user-bazel AS build-java-bazel

USER bazeluser
RUN sudo ./tools/java/package_proto_jar.sh -c true