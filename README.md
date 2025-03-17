# opensearch-protobufs

This repository stores the Protobufs and generated code used for client <> server GRPC APIs.

The [opensearch-api-specification repo](https://github.com/opensearch-project/opensearch-api-specification)  will continue to be the source of truth, and these protobufs will mostly be a downstream consumer of the spec.

This repository will also include a variety of tooling and CI, linters and validators, and generated code, described in more default below.

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
