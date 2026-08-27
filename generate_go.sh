#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
#
# The OpenSearch Contributors require contributions made to
# this file be licensed under the Apache-2.0 license or a
# compatible open source license.

set -euo pipefail

MODULE="github.com/opensearch-project/opensearch-protobufs"
# Must match option go_package in .proto files (strip MODULE prefix -> generated/go/...)
GEN_ROOT="generated/go"

rm -rf "${GEN_ROOT}/opensearchpb" "${GEN_ROOT}/services"
mkdir -p "${GEN_ROOT}"

PROTO_FILES=$(find protos -name "*.proto" -type f)

protoc \
  --proto_path=. \
  --go_out=. --go_opt=module="${MODULE}" \
  --go-grpc_out=. --go-grpc_opt=module="${MODULE}" \
  ${PROTO_FILES}

echo "Go protobuf generation complete. Output in ${GEN_ROOT}/"
