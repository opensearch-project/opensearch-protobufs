#!/bin/bash
# Script to generate Java files from proto files using Bazel
set -vex

function exit_script() {
    echo "Exit 1"
    exit 1
}

# Trap abnormal exit due to bazel not return non-zero status
trap exit_script TERM INT

# Set up variables
ROOT_DIR="`dirname "$(realpath $0)"`/../.."
OUTPUT_DIR="$ROOT_DIR/generated/java"
BAZEL_BIN_DIR=$(readlink -f bazel-bin)

# Clean up existing output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Build the Java proto library
echo "Building Java proto library..."
cd $ROOT_DIR && bazel build //... && cd - > /dev/null

# Find all source JAR files
echo "Finding source JAR files..."
SRC_JARS=$(find "$BAZEL_BIN_DIR"/ -name "*-speed-src.jar")
SRC_JARS+=" "
SRC_JARS+=$(find "$BAZEL_BIN_DIR"/ -name "*grpc_java-src.jar")
echo $SRC_JARS
# Extract Java files from source JAR files
echo "Extracting Java files from source JAR files..."
for jar in $SRC_JARS; do
  echo "Extracting $jar..."
  (cd "$OUTPUT_DIR" && jar xf "$jar")
done

rm -rf "$OUTPUT_DIR/com/google/protobuf"

echo "Done! Generated Java files are in $OUTPUT_DIR"
