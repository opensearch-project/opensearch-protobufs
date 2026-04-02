#!/bin/bash
# Script to package generated Go proto files into a distributable archive
set -e

# Configuration
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR_ROOT="$ROOT_DIR/generated"
OUTPUT_DIR_GO="$OUTPUT_DIR_ROOT/go"

# Parameters
function usage() {
    echo "Usage: $0 [args]"
    echo ""
    echo "Arguments:"
    echo -e "-c CLEAN_GENERATED\t[Optional] default to 'false', set to 'true' will remove generated directory"
    echo -e "-s IS_SNAPSHOT\t[Optional] default to 'true', set to 'false' will generate official build artifacts."
    echo -e "-h help"
}

CLEAN_GENERATED='false'
IS_SNAPSHOT='true'

while getopts "c:s:h" opt; do
  case $opt in
    h)
      usage
      exit 1
      ;;
    c)
      CLEAN_GENERATED="$OPTARG"
      ;;
    s)
      IS_SNAPSHOT="$OPTARG"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      exit 1
      ;;
  esac
done

if [ "$CLEAN_GENERATED" = "true" ]; then
    echo "Cleanup $OUTPUT_DIR_GO"
    rm -rf "$OUTPUT_DIR_GO"
fi

if [ "$IS_SNAPSHOT" != "true" ] && [ "$IS_SNAPSHOT" != "false" ]; then
    echo "Error: IS_SNAPSHOT must be either 'true' or 'false', exit 1"
    exit 1
fi

# Get version from version.properties
VERSION=$(grep 'version=' "${ROOT_DIR}/version.properties" | cut -d'=' -f2)
if [ "$IS_SNAPSHOT" = "true" ]; then
    VERSION="${VERSION}-SNAPSHOT"
fi

if [ -z "$VERSION" ]; then
    echo "Error: VERSION is empty, exit 1"
    exit 1
fi

echo "Building Go protobuf package version: ${VERSION}"

# Step 1: Build Go protos with Bazel
echo "Building Go protos with Bazel..."
cd "$ROOT_DIR"
bazel build //:go_protos_all

# Step 2: Create output directory structure
echo "Creating output directory structure..."
mkdir -p "$OUTPUT_DIR_GO/opensearchpb"
mkdir -p "$OUTPUT_DIR_GO/services"

# Step 3: Copy generated Go protobuf files
echo "Copying generated Go protobuf files..."
find bazel-bin/protos/schemas -name "*.pb.go" -path "*_go_proto_*" -exec cp {} "$OUTPUT_DIR_GO/opensearchpb/" \;
find bazel-bin/protos/services -name "*.pb.go" -path "*_go_proto_*" -exec cp {} "$OUTPUT_DIR_GO/services/" \;

# Verify files were copied
SCHEMA_COUNT=$(find "$OUTPUT_DIR_GO/opensearchpb" -name "*.pb.go" | wc -l)
SERVICE_COUNT=$(find "$OUTPUT_DIR_GO/services" -name "*.pb.go" | wc -l)

if [ "$SCHEMA_COUNT" -eq 0 ] || [ "$SERVICE_COUNT" -eq 0 ]; then
    echo "Error: No .pb.go files found. Schema files: $SCHEMA_COUNT, Service files: $SERVICE_COUNT"
    exit 1
fi

echo "Copied $SCHEMA_COUNT schema files and $SERVICE_COUNT service files"

# Step 4: Fix import paths from Bazel paths to Go module paths
echo "Fixing import paths..."
MODULE_PATH="github.com/opensearch-project/opensearch-protobufs/go"
find "$OUTPUT_DIR_GO" -name "*.pb.go" -exec sed -i \
    -e "s|\"protos/schemas/common_go_proto\"|\"${MODULE_PATH}/opensearchpb\"|g" \
    -e "s|\"protos/services/document_service_go_proto\"|\"${MODULE_PATH}/services\"|g" \
    -e "s|\"protos/services/search_service_go_proto\"|\"${MODULE_PATH}/services\"|g" \
    {} \;

# Step 5: Create go.mod
echo "Creating go.mod..."
cat > "$OUTPUT_DIR_GO/go.mod" << 'EOF'
module github.com/opensearch-project/opensearch-protobufs/go

go 1.18

require (
	google.golang.org/protobuf v1.31.0
	google.golang.org/grpc v1.58.0
)
EOF

# Step 5: Run go mod tidy to resolve dependencies and generate go.sum
echo "Running go mod tidy..."
cd "$OUTPUT_DIR_GO"
go mod tidy

# Step 6: Validate that Go code compiles
echo "Validating Go code compiles..."
go build ./...
echo "Go code compiled successfully"

# Step 7: Copy license files
cd "$ROOT_DIR"
if [ -f "LICENSE.txt" ]; then
    cp "LICENSE.txt" "$OUTPUT_DIR_GO/"
elif [ -f "LICENSE" ]; then
    cp "LICENSE" "$OUTPUT_DIR_GO/"
fi

if [ -f "NOTICE" ]; then
    cp "NOTICE" "$OUTPUT_DIR_GO/"
fi

# Step 8: Create README
cat > "$OUTPUT_DIR_GO/README.md" << EOF
# OpenSearch Protocol Buffers for Go v${VERSION}

Pre-generated Go protobuf code for OpenSearch gRPC APIs.

## Installation

1. Download and extract this archive
2. Add to your project using a replace directive in go.mod:

\`\`\`
require github.com/opensearch-project/opensearch-protobufs/go v${VERSION}

replace github.com/opensearch-project/opensearch-protobufs/go => ./path/to/opensearch-protobufs-go-${VERSION}
\`\`\`

## Usage

\`\`\`go
import (
    "github.com/opensearch-project/opensearch-protobufs/go/opensearchpb"
    "github.com/opensearch-project/opensearch-protobufs/go/services"
)

// Use generated message types
request := &opensearchpb.SearchRequest{
    Query: "elasticsearch",
    Size:  10,
}

// Use generated gRPC clients
client := services.NewSearchServiceClient(conn)
response, err := client.Search(ctx, request)
\`\`\`

## Dependencies

- google.golang.org/protobuf v1.31.0
- google.golang.org/grpc v1.58.0

## More Information

For more information, visit:
https://github.com/opensearch-project/opensearch-protobufs
EOF

# Step 9: Create tar.gz archive
echo "Creating tar.gz archive..."
cd "$OUTPUT_DIR_ROOT"
ARCHIVE_DIR="opensearch-protobufs-go-${VERSION}"
mv go "$ARCHIVE_DIR"
tar -czf "$ROOT_DIR/opensearch-protobufs-go.tar.gz" "$ARCHIVE_DIR/"
mv "$ARCHIVE_DIR" go

echo ""
echo "Successfully created: opensearch-protobufs-go.tar.gz"
echo ""
echo "Archive contents:"
tar -tzf "$ROOT_DIR/opensearch-protobufs-go.tar.gz"
echo ""
echo "To use in a Go project:"
echo ""
echo "1. Extract: tar -xzf opensearch-protobufs-go.tar.gz"
echo "2. Add to go.mod:"
echo "   require github.com/opensearch-project/opensearch-protobufs/go v${VERSION}"
echo "   replace github.com/opensearch-project/opensearch-protobufs/go => ./opensearch-protobufs-go-${VERSION}"
