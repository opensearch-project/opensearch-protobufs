# Usage `docker build --target <stage-name> -t opensearch-proto-python -f Dockerfile.py .` 

###############################################################################
# Stage 1: Discover .proto files and build python source with protoc
###############################################################################

FROM python:3.10-slim AS proto-build

# Notes on OpenSearch trying to match core proto & gRPC versions: 
# https://github.com/opensearch-project/OpenSearch/blob/main/gradle/libs.versions.toml
# - No pip package for grpcio 1.68.2 so we use closest 1.68.1 release.
# - pip packages bump major versions independently of pensource protobuf repo - in both java & python the minor version corresponds to open source release tags.
# - pip enforces "grpcio-tools 1.68.1 depends on protobuf<6.0dev and >=5.26.1" so we have to bump proto 25.5 -> 26.1.

ENV PIP_GRPCIO_VERSION=1.68.1
ENV PIP_GRPCIO_TOOLS_VERSION=1.68.1
ENV PIP_PROTOBUF_VERSION=5.26.1

RUN pip install --upgrade pip
RUN apt-get update && apt-get install -y \
    protobuf-compiler \
    git \
    sed \
    findutils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN pip install --no-cache-dir grpcio==$PIP_GRPCIO_VERSION grpcio-tools==$PIP_GRPCIO_TOOLS_VERSION protobuf==$PIP_PROTOBUF_VERSION

# Copy entire repository for convenience
COPY . .

# Discover proto files and run protoc compiler
RUN bash -c 'set -e; \
    # Set up variables \
    ROOT_DIR="/build"; \
    OUTPUT_DIR="$ROOT_DIR/generated/python"; \
    PROTO_DIR="$ROOT_DIR/protos"; \
    \
    # Create output directory \
    rm -rf "$OUTPUT_DIR"; \
    mkdir -p "$OUTPUT_DIR"; \
    touch "$OUTPUT_DIR/__init__.py"; \
    \
    echo "Generating Python code from Proto files..."; \
    \
    # Find all proto files \
    SCHEMA_PROTO_FILES=$(find "$PROTO_DIR/schemas" -name "*.proto"); \
    SERVICE_PROTO_FILES=$(find "$ROOT_DIR" -maxdepth 1 -name "*.proto"); \
    ALL_PROTO_FILES="$SCHEMA_PROTO_FILES $SERVICE_PROTO_FILES"; \
    \
    # Create Python package structure \
    mkdir -p "$OUTPUT_DIR/protos/schemas"; \
    touch "$OUTPUT_DIR/protos/__init__.py"; \
    touch "$OUTPUT_DIR/protos/schemas/__init__.py"; \
    \
    # Generate Python code using grpcio-tools package \
    python -m grpc_tools.protoc \
        --proto_path="$ROOT_DIR" \
        --python_out="$OUTPUT_DIR" \
        --grpc_python_out="$OUTPUT_DIR" \
        $ALL_PROTO_FILES; \
    \
    echo "Python code generation completed!"; \
    \
    # Fix imports in generated Python files \
    find "$OUTPUT_DIR" -name "*.py" -type f -exec sed -i.bak "s/^import protos\./import generated.python.protos./g" {} \; ; \
    find "$OUTPUT_DIR" -name "*.py" -type f -exec sed -i.bak "s/^from protos\./from generated.python.protos./g" {} \; ; \
    find "$OUTPUT_DIR" -name "*.bak" -type f -delete; \
    \
    echo "Done! Generated Python files are in $OUTPUT_DIR"; \
'

###############################################################################
# Stage 2: Create a small image to test generated python source
###############################################################################

FROM python:3.10-slim as proto-test
WORKDIR /app
COPY --from=proto-build /build/generated/python /app/generated/python
RUN pip install --no-cache-dir grpcio protobuf

# Create a python project structure
RUN cd /app && \
    touch generated/__init__.py && \
    touch generated/python/__init__.py
ENV PYTHONPATH="/app:${PYTHONPATH}"

# Small discover modules test
RUN echo 'import sys; print("Python version:", sys.version); print("Available modules:"); import os; print(os.listdir("/app/generated/python"))' > /app/test_imports.py

CMD ["python", "/app/test_imports.py"]

###############################################################################
# Stage 3: Construct python package and generate wheel file
###############################################################################

FROM python:3.10-slim AS make-package
WORKDIR /build
COPY --from=proto-builder /app/generated/python /build/opensearch_protos
RUN pip install --no-cache-dir setuptools wheel build

# Create the Python package structure
RUN mkdir -p opensearch_protos_package/opensearch_protos && \
    touch opensearch_protos_package/opensearch_protos/__init__.py && \
    cp -r /build/opensearch_protos/* opensearch_protos_package/opensearch_protos/ && \
    find opensearch_protos_package/opensearch_protos -type d -exec touch {}/__init__.py \;

# Create setup.py for package
RUN echo 'from setuptools import setup, find_packages\n\
\n\
setup(\n\
    name="opensearch-protos",\n\
    version="0.1.0",\n\
    description="OpenSearch Protocol Buffers Python Client",\n\
    author="OpenSearch Contributors",\n\
    author_email="opensearch@example.com",\n\
    url="https://github.com/opensearch-project/opensearch-protobufs",\n\
    packages=find_packages(),\n\
    install_requires=[\n\
        "grpcio>='${PIP_GRPCIO_VERSION}'",\n\
        "protobuf>='${PIP_PROTOBUF_VERSION}'",\n\
        "grpcio-reflection>='${PIP_GRPCIO_VERSION}'",\n\
    ],\n\
    classifiers=[\n\
        "Development Status :: 3 - Alpha",\n\
        "Intended Audience :: Developers",\n\
        "License :: OSI Approved :: Apache Software License",\n\
        "Programming Language :: Python :: 3",\n\
        "Programming Language :: Python :: 3.8",\n\
        "Programming Language :: Python :: 3.9",\n\
        "Programming Language :: Python :: 3.10",\n\
    ],\n\
    python_requires=">=3.8",\n\
)' > opensearch_protos_package/setup.py

# Build the package
WORKDIR /build/opensearch_protos_package
RUN python -m build

# Create dist dir and copy wheel
RUN mkdir -p /dist && \
    cp dist/*.whl /dist/

###############################################################################
# Stage 4: Helper stage to copy dist from image
###############################################################################

FROM scratch AS package-out
COPY --from=package-builder /dist /dist