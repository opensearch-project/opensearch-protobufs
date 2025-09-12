#!/bin/bash
# Script to package python proto files into a wheel
# This script updates version.bzl from version.properties and then builds the wheel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "Packaging Python protobuf wheel..."

# Get version from version.properties
VERSION=$(grep '^version=' "${ROOT_DIR}/version.properties" | cut -d'=' -f2)
echo "Found version: ${VERSION}"

# Update version.bzl with the current version
echo "Updating version.bzl..."
cat > "${ROOT_DIR}/version.bzl" << EOF
"""Version information read from version.properties."""

# This file is generated - do not edit manually
VERSION = "${VERSION}"
EOF

echo "Updated version.bzl with version ${VERSION}"

# Build the wheel using Bazel
echo "Building wheel with Bazel..."
cd "${ROOT_DIR}"
bazel build //:opensearch_protos_wheel

# Find the generated wheel file
WHEEL_FILE=$(find bazel-bin -name "*.whl" -type f | head -n 1)
if [ -n "$WHEEL_FILE" ]; then
    echo "Successfully built wheel: ${WHEEL_FILE}"
    echo "Wheel filename: $(basename "$WHEEL_FILE")"
else
    echo "Error: Could not find generated wheel file"
    exit 1
fi