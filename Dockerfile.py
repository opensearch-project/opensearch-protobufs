# Usage `docker build --target <stage-name> -t opensearch-proto-python -f Dockerfile.py .` 
# Dockerfile must be located at the root of: https://github.com/opensearch-project/opensearch-protobufs

###############################################################################
# Stage 0: Setup shared environment/base image
###############################################################################

FROM python:3.10-slim AS base

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

###############################################################################
# Stage 1: Discover .proto files and build python source with protoc
###############################################################################

FROM base AS proto-build
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
    find "$OUTPUT_DIR" -name "*.py" -type f -exec sed -i.bak "s/^import protos\./import opensearch_protos.protos./g" {} \; ; \
    find "$OUTPUT_DIR" -name "*.py" -type f -exec sed -i.bak "s/^from protos\./from opensearch_protos.protos./g" {} \; ; \
    find "$OUTPUT_DIR" -name "*.bak" -type f -delete; \
    \
    echo "Done! Generated Python files are in $OUTPUT_DIR"; \
'

###############################################################################
# Stage 2: Construct python package and generate wheel file
###############################################################################

FROM base AS make-package
WORKDIR /build
COPY --from=proto-build /build/generated/python /build/opensearch_protos
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
    version="1.0.0",\n\
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
# Stage 3: Helper stage to validate and copy dist from image
###############################################################################

FROM base AS package-out
COPY --from=make-package /dist /dist
WORKDIR /dist

# Small sanity test script to load and use package
RUN echo 'import grpc\n\
from opensearch_protos.protos.schemas import document_pb2\n\
\n\
def testdocument_pb2BulkRequest():\n\
    bulk_request = document_pb2.BulkRequest()\n\
    body = bulk_request.request_body.add()\n\
    body.index.id = "doc1"\n\
    body.index.index = "my_index"\n\
    body.doc = b'{"field1": "value1", "field2": 42}'\n\
    print(bulk_request.SerializeToString())\n\

if __name__ == "__main__":\n\
    testdocument_pb2BulkRequest()\n\
)' > test.py
RUN python test.py 

VOLUME /output
CMD ["cp", "-r", "/dist", "/output/"]