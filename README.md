# opensearch-protobufs

This repository stores the Protobufs and generated code used for client <> server GRPC APIs.

The [opensearch-api-specification repo](https://github.com/opensearch-project/opensearch-api-specification) will continue to be the source of truth, and these protobufs will mostly be a downstream consumer of the spec.

This repository will also include a variety of tooling and CI, linters and validators, and generated code, which is described in more detail below.

## Quick Start

## Protobuf Conversion Guide

To generate Protobuf definitions from the latest OpenSearch API specification, follow these steps. All commands are intended to be run from the project root directory.

1. **Download the latest OpenSearch API Specification**


   ```bash
   curl -L -o opensearch-openapi.yaml \
     https://github.com/opensearch-project/opensearch-api-specification/releases/download/main-latest/opensearch-openapi.yaml
   ```

2. **Run Preprocessing**

   ```bash
   npm ci && npm run preprocessing
   ```

3. **Download OpenAPI Generator CLI**

   ```bash
   curl -L -f -o openapi-generator-cli.jar \
     https://github.com/opensearch-project/opensearch-protobufs/releases/download/openapi-generator-tool/openapi-generator-cli.jar
   ```

4. **Convert to Protobuf**

   ```bash
   java -jar openapi-generator-cli.jar generate -c tools/proto-convert/src/config/protobuf-generator-config.yaml
   ```

5. **Run Postprocessing**

   ```bash
   npm run postprocessing
   ```

After these steps, you will find the generated Protobuf definitions in the `generated/` directory. Note that service files need be manually created. You can use `generated/services/default_service.proto` as a reference for defining gRPC service definitions.

### Additional Notes

- **For Search/Bulk Requests:**
  Protobufs for search and bulk operations are already provided in the repository. Some schemas are excluded from generation because they lack proper gRPC support. The exclusion list is defined in [`spec-filter.yaml`](tools/proto-convert/src/config/spec-filter.yaml) under the `excluded_schemas` section.

- **For Other Requests:**
  For other APIs, you can generate their Protobuf definitions locally. Review the generated files to ensure they meet your requirements. If they do, submit a Pull Request (PR) to the `opensearch-protobufs` repository to add the new API path to [`spec-filter.yaml`](tools/proto-convert/src/config/spec-filter.yaml), and request a maintainer to merge PR and execute the workflow that will automatically generate and incorporate the Protobufs.

**Note:** Make sure you are running all commands from the project root folder.



### Build Protobuf Libraries

Generate protobuf libraries for your preferred language:

```bash
# Java
bazel build //:java_protos_all

# Python
bazel build //:python_protos_all

# Go
bazel build //:go_protos_all

# All languages
bazel build //:java_protos_all //:python_protos_all //:go_protos_all
```

### Docker Build Options

Use Docker to build and test protobuf libraries:

```bash
# Java
docker build --target build-bazel-java .
docker build --target package-bazel-java .
docker build --target test-bazel-java .

# Python
docker build --target build-bazel-python .
docker build --target package-bazel-python .
docker build --target test-bazel-python .

# Go
docker build --target build-bazel-go .
docker build --target package-bazel-go .
docker build --target test-bazel-go .
```

## Releases

Each OpenSearch Protobufs release includes:

- **Java Archive**: `opensearch-protobufs-java.tar.gz` - Maven-compatible JAR files for Java/Gradle projects
- **Protobuf ZIP**: `opensearch-protobufs-{version}.zip` - Raw `.proto` files for generating client libraries in any language

Download the latest release from the [GitHub Releases page](https://github.com/opensearch-project/opensearch-protobufs/releases).

### Using Raw Proto Files

1. Download `opensearch-protobufs-{version}.zip` from releases to get just the `.proto` files:

2. Extract the zip:
```bash
unzip opensearch-protobufs-{version}.zip
cd opensearch-protobufs-{version}
```
3. Follow latest documentation on https://protobuf.dev/reference/ to generate client libraries for different languages.

## Generated Code Usage

### Go

```go
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
```

### Java

```java
import org.opensearch.protobufs.SearchRequest;
import org.opensearch.protobufs.services.SearchServiceGrpc;

// Use generated message types
SearchRequest request = SearchRequest.newBuilder()
    .setQuery("elasticsearch")
    .setSize(10)
    .build();

// Use generated gRPC clients
SearchServiceGrpc.SearchServiceBlockingStub client =
    SearchServiceGrpc.newBlockingStub(channel);
SearchResponse response = client.search(request);
```

### Python

```python
from opensearch.protobufs.schemas import SearchRequest, BulkRequest, IndexDocumentRequest
from opensearch.protobufs.services import SearchServiceStub

# Use generated message types
request = SearchRequest()
request.query = "elasticsearch"
request.size = 10

# Use generated gRPC clients
client = SearchServiceStub(channel)
response = client.Search(request)
```

## Generated Code Locations

After building, find generated code in:

```bash
# Go
bazel-bin/protos/schemas/*_go_proto_pb/protos/schemas/*.pb.go
bazel-bin/protos/services/*_go_proto_pb/protos/services/*.pb.go

# Java
bazel-bin/libjava_protos_all.jar

# Python
bazel-bin/opensearch/protobufs/schemas/
bazel-bin/opensearch/protobufs/services/
```

## Intended usage of the repo

The repo will consist of:

1. **Protobufs**
    - Raw `*.proto` files based on the API spec
    - Build files/tooling to compile the protobufs

2. **Generated code:**
    - The generated code for Java/Go/Python/etc languages, which can be imported as jars/packages into the downstream repos that need them. Having already packaged generated protobuf code makes it easy to import into the various repos (e.g. `OpenSearch` core, `opensearch-java-client`, `opensearch-python`, `opensearch-benchmark`, etc) and avoids duplicate efforts to regenerate them in every single repository.

3. **Tooling and CI**
    - Tooling to [auto generate the `*.proto` files from the `opensearch-api-specification`](https://github.com/opensearch-project/opensearch-api-specification/issues/677) and [GHAs](https://github.com/opensearch-project/opensearch-api-specification/issues/653) to trigger the conversion scripts
    - Tooling (i.e Bazel files / scripts) to produce the protobuf generated code using `protoc`, and CI to trigger it automatically upon `.proto` file changes

4. **Linters/Validators (TBD)**
    - Tooling to validate and lint the generated `*.proto` files, to ensure they conform to Google's protobuf best practices, as well as conventions established within the OpenSearch org (more important for any portions that are hand-rolled)

## Development

For development documentation, see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).

## CI/CD

GitHub Actions workflows automatically validate protobuf builds:
- `build-protobufs-java.yml` - Validates Java protobuf generation
- `build-protobufs-python.yml` - Validates Python protobuf generation
- `build-protobufs-go.yml` - Validates Go protobuf generation

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.
