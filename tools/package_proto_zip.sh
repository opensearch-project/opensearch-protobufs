#!/bin/bash
# Script to package proto files into a zip for release

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Get version from version.properties
VERSION=$(grep 'version=' "${ROOT_DIR}/version.properties" | cut -d'=' -f2)
ZIP_NAME="opensearch-protobufs-${VERSION}.zip"

echo "Creating protobuf zip: ${ZIP_NAME}"

# Create temporary directory for organization
TEMP_DIR=$(mktemp -d)
PROTO_DIR="${TEMP_DIR}/opensearch-protobufs-${VERSION}"

# Copy proto files with structure
mkdir -p "${PROTO_DIR}/schemas"
mkdir -p "${PROTO_DIR}/services"

cp "${ROOT_DIR}/protos/schemas"/*.proto "${PROTO_DIR}/schemas/"
cp "${ROOT_DIR}/protos/services"/*.proto "${PROTO_DIR}/services/"

# Add a README for the zip
cat > "${PROTO_DIR}/README.txt" << EOF
OpenSearch Protocol Buffers v${VERSION}

This archive contains the Protocol Buffer (.proto) files for OpenSearch gRPC APIs.

Structure:
- schemas/     - Core data structure definitions
- services/    - gRPC service definitions

Usage:
Use these .proto files with your preferred Protocol Buffer compiler (protoc)
to generate client libraries for your programming language.

For more information, visit:
https://github.com/opensearch-project/opensearch-protobufs

EOF

# Create the zip
cd "${TEMP_DIR}"
zip -r "${ROOT_DIR}/${ZIP_NAME}" "opensearch-protobufs-${VERSION}/"

# Cleanup
rm -rf "${TEMP_DIR}"

echo "Successfully created: ${ZIP_NAME}"
echo "Contents:"
unzip -l "${ROOT_DIR}/${ZIP_NAME}"
