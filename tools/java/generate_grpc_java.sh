#!/bin/bash
set -vex
# Script to generate Java gRPC stubs from proto files using protoc

# Set up variables
OUTPUT_DIR="generated/java"
PROTO_DIR="."
TEMP_DIR="/tmp/grpc-java-plugin"
GRPC_VERSION="1.38.0"
OS="linux"
ARCH="x86_64"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Download the protoc-gen-grpc-java plugin if it doesn't exist
PLUGIN_URL="https://repo1.maven.org/maven2/io/grpc/protoc-gen-grpc-java/${GRPC_VERSION}/protoc-gen-grpc-java-${GRPC_VERSION}-${OS}-${ARCH}.exe"
PLUGIN_PATH="${TEMP_DIR}/protoc-gen-grpc-java-${GRPC_VERSION}.exe"

if [ ! -f "$PLUGIN_PATH" ]; then
  echo "Downloading protoc-gen-grpc-java plugin..."
  mkdir -p "$TEMP_DIR"
  curl -L -o "$PLUGIN_PATH" "$PLUGIN_URL"
  chmod +x "$PLUGIN_PATH"
fi

# Generate gRPC stubs for document_service.proto
echo "Generating gRPC stubs for document_service.proto..."
protoc \
  --plugin=protoc-gen-grpc-java="$PLUGIN_PATH" \
  --grpc-java_out="$OUTPUT_DIR" \
  --proto_path="$PROTO_DIR" \
  document_service.proto

# Generate gRPC stubs for search_service.proto
echo "Generating gRPC stubs for search_service.proto..."
protoc \
  --plugin=protoc-gen-grpc-java="$PLUGIN_PATH" \
  --grpc-java_out="$OUTPUT_DIR" \
  --proto_path="$PROTO_DIR" \
  search_service.proto

# Check if the gRPC stubs were generated
if [ -f "$OUTPUT_DIR/org/opensearch/protobuf/services/DocumentServiceGrpc.java" ] && [ -f "$OUTPUT_DIR/org/opensearch/protobuf/services/SearchServiceGrpc.java" ]; then
  echo "Successfully generated gRPC stubs!"
else
  echo "Warning: gRPC stubs may not have been generated correctly."
  echo "Checking for gRPC stubs in the current directory..."
  find . -name "*Grpc.java"
fi

echo "Done! Generated gRPC stubs are in $OUTPUT_DIR"
