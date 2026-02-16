# Prerequisites
Install bazel, using the version in .bazelversion.

# Compile protos and grpc

## All artifacts
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

# Proto generated code
## Java
### Generate Java Code and packaging as a Maven/Gradle dependency

To package the generated Java files into a Maven-compatible JAR that can be used as a Gradle dependency, run the provided script:
```bash
#optional
rm -rf bazel*

rm -rf generated && bazel build //:java_protos_all && ./tools/java/package_proto_jar.sh
```

This script will:
- Generate Java files from proto files (if not already done)
- Download the protobuf-java dependency
- Compile the Java files
- Create a Maven-compatible JAR file
- Install the JAR to your local Maven repository

2. To use the JAR in a Gradle project, add the following to your build.gradle:
where VERSION is the number set in [version.properties](./version.properties) (e.g. 0.3.0)

If using jar stored locally:
```
dependencies {
  implementation files("${rootProject.projectDir}/protobufs-{VERSION}-SNAPSHOT.jar")
```

If using local Maven:
```
repositories {
    mavenLocal()
}

dependencies {
    implementation 'org.opensearch.protobufs:opensearch-protobufs:{VERSION}-SNAPSHOT'
}
```
If using snapshot jar uploaded to sonatype:
```
repositories {
  maven {
    url = 'https://ci.opensearch.org/ci/dbc/snapshots/maven/'
  }
}

dependencies {
    implementation 'org.opensearch.protobufs:opensearch-protobufs:{VERSION}-SNAPSHOT'
}
```

## Python
### Generate and install Python Code

Generate the wheel file with bazel and install the packag with pip:
```
bazel build //:opensearch_protos_wheel
pip install bazel-bin/opensearch_protos-*-py3-none-any.whl
```

# Protobuf Generation Process

## Overview

The protobuf generation process consists of three main phases:
1. **Preprocessing**: Filters and prepares the OpenAPI spec
2. **Generation**: Converts OpenAPI to protobuf definitions
3. **Postprocessing**: Ensures backward compatibility and merges with existing schemas

## Adding New APIs

To add a new API endpoint to the protobuf definitions:

### Step 1: Find the Operation Group

Locate the `x-operation-group` tag in the OpenSearch OpenAPI specification for your target endpoint. For example:

```yaml
paths:
  /{index}/_search:
    get:
      x-operation-group: search
      # ...
```

### Step 2: Update spec-filter.yaml

Add the operation group to [`tools/proto-convert/src/config/spec-filter.yaml`](tools/proto-convert/src/config/spec-filter.yaml):

```yaml
# Target operation groups to include in proto generation
x-operation-groups:
  - bulk
  - search
  - your-new-group  # Add your operation group here
```


### Step 3: Handle Excluded Schemas

The `excluded_schemas` list contains OpenSearch schemas that are not yet implemented in the gRPC API. When a schema is excluded:
- It will not be generated as a protobuf message
- Any references to it in other messages will be omitted
- The generation process will skip its nested dependencies


**To add support for an existing schema:**
If you want to implement support for a currently excluded schema, remove it from the `excluded_schemas` list:

```yaml
excluded_schemas:
  - AggregationContainer
  # - QueryStringQuery  # Remove this line to generate QueryStringQuery
```

After removing a schema from the exclusion list, regenerate the protobufs to include the newly supported schema.

### Step 4: Trigger Generation

**For spec-filter.yaml changes** (new operation groups or excluded schema modifications):
- Manually trigger the **Auto Proto Convert** workflow from GitHub Actions
- The workflow will generate the protobufs and create a commit

**For existing schema changes from Spec** (OpenAPI spec updates for already included schemas):
- The workflow runs automatically when the OpenSearch API specification is updated
- It monitors commits to the spec that affect existing protobuf messages
- If changes are detected, it automatically generates updated protobufs and creates a commit

## Backward Compatibility

The postprocessing step automatically maintains backward compatibility:

- **Fields removed from spec**: Marked as `deprecated` to preserve field numbers
- **Fields with type changes**: The old field is deprecated, and a new versioned field is created (e.g., `field_name_2`)
- **Fields added to spec**: Assigned the next available field number without reusing existing numbers

### Manually Maintained Fields

If you need to add a new field to an existing protobuf message that is not part of the OpenAPI spec, mark it with the `tooling_skip` option when you add it. This prevents the postprocessing tool from marking it as deprecated during future regenerations.

Add `[(tooling_skip) = true]` to the specific field within the message definition (e.g., in `protos/schemas/common.proto`):

```protobuf
message BulkRequestBody {
  // Existing fields from the spec
  string index = 1;
  string type = 2;

  // Manually added field - marked with tooling_skip to prevent auto-deprecation
  map<string, BinaryFieldValue> field_values = 4 [(tooling_skip) = true];
}
```

The `[(tooling_skip) = true]` option should be added to any manually introduced field at the time you add it to the message.

**When to use `tooling_skip`:**
- Fields manually added for gRPC-specific functionality
- Fields that won't appear in the OpenAPI spec but are needed for protobuf

**Important:** This option only works for message fields, not enum values.

# Protobuf Local Convert Guide

To generate Protobuf definitions from the latest OpenSearch API specification locally, follow these steps. All commands are intended to be run from the project root directory.

## Prerequisites

- **Node.js** >= v22
- **Java** >= 17

**Note:** If you're using an internal npm registry that blocks recent packages, configure npm to use the public registry:

```bash
npm config set registry https://registry.npmjs.org/
```

1. **Download the latest OpenSearch API Specification**


   ```bash
   curl -L -o opensearch-openapi.yaml \
     https://github.com/opensearch-project/opensearch-api-specification/releases/download/main-latest/opensearch-openapi.yaml
   ```

2. **Run Preprocessing**

   ```bash
   npm ci && npm run preprocessing
   ```

3. **Generate Protobuf**

   ```bash
  export OPENAPI_GENERATOR_VERSION=7.19.0
  npx @openapitools/openapi-generator-cli generate \
    -c tools/proto-convert/src/config/protobuf-generator-config.yaml
   ```

4. **Run Postprocessing**

   ```bash
   npm run postprocessing
   ```

After these steps, you will find the generated Protobuf service definitions in the `generated/services/default_service.proto`. Note that service files need be manually created. You can use `generated/services/default_service.proto` as a reference for defining gRPC service definitions.

### Additional Notes

- **For Search/Bulk Requests:**
  Protobufs for search and bulk operations are already provided in the repository. Some schemas are excluded from generation because they don't have gRPC supported. The exclusion list is defined in [`spec-filter.yaml`](tools/proto-convert/src/config/spec-filter.yaml) under the `excluded_schemas` section.

- **For Other Requests:**
  For other APIs, generate Protobuf definitions locally and review them to ensure they meet your requirements. We recommend implementing and testing a gRPC server with the generated Protobufs to verify correctness. Once validated, submit a Pull Request to add the new API path to [`spec-filter.yaml`](tools/proto-convert/src/config/spec-filter.yaml). A maintainer will merge the PR and run the workflow to automatically generate and incorporate the Protobufs.

**Note:** Make sure you are running all commands from the project root folder.


# Ignored files

All generated files are excluded from version control via the `.gitignore` file. This includes:
- Bazel generated files (bazel-*)
- Generated files (generated/)
- Compiled class files (*.class)
- Package files (*.jar)
