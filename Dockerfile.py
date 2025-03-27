FROM python:3.10-slim AS proto-build

# Build and run
# docker build --target proto-build -t opensearch-proto-python -f Dockerfile.py .
# docker build --target proto-run -t opensearch-proto-python -f Dockerfile.py .

ENV PIP_GRPCIO_VERSION=1.69.0
ENV PIP_GRPCIO_TOOLS_VERSION=1.69.0
ENV PIP_PROTOBUF_VERSION=4.3.0

# Update pip
RUN pip install --upgrade pip

# Set up container dependencies
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

# Setup and 
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

# Stage 2: Create a lightweight runtime image
FROM python:3.10-slim as proto-run

# Set working directory
WORKDIR /app

# Copy only the generated Python code from the builder stage
COPY --from=proto-build /build/generated/python /app/generated/python

# Install runtime dependencies
RUN pip install --no-cache-dir grpcio protobuf

# Create a Python package structure
RUN cd /app && \
    touch generated/__init__.py && \
    touch generated/python/__init__.py

# Add the package to Python path
ENV PYTHONPATH="/app:${PYTHONPATH}"

# Create a simple test script to verify imports
RUN echo 'import sys; print("Python version:", sys.version); print("Available modules:"); import os; print(os.listdir("/app/generated/python"))' > /app/test_imports.py

# Command to run when container starts
CMD ["python", "/app/test_imports.py"]