#!/bin/bash
# Script to generate Java files from proto files using Bazel

# Set up variables
OUTPUT_DIR="generated/java"
BAZEL_BIN_DIR=$(readlink -f bazel-bin)

# Clean up existing output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Build the Java proto library
echo "Building Java proto library..."
cd $(dirname "$0")/../.. && bazel build :protos_java && cd - > /dev/null

# Find all source JAR files
echo "Finding source JAR files..."
SRC_JARS=$(find "$BAZEL_BIN_DIR" -name "*-speed-src.jar")

# Extract Java files from source JAR files
echo "Extracting Java files from source JAR files..."
for jar in $SRC_JARS; do
  echo "Extracting $jar..."
  (cd "$OUTPUT_DIR" && jar xf "$jar")
done

echo "Done! Generated Java files are in $OUTPUT_DIR"
