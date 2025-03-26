# Prerequisites
Install bazel, using the version in .bazelversion.

# Compile protos and grpc
```
bazel build //...
```
# Proto generated code
## Java
### Generate Java Code and packaging as a Maven/Gradle dependency

To package the generated Java files into a Maven-compatible JAR that can be used as a Gradle dependency, run the provided script:
```bash
#optional
rm -rf bazel*

rm -rf generated && bazel build //... && ./tools/java/package_proto_jar.sh
```

This script will:
- Generate Java files from proto files (if not already done)
- Download the protobuf-java dependency
- Compile the Java files
- Create a Maven-compatible JAR file
- Install the JAR to your local Maven repository

2. To use the JAR in a Gradle project, add the following to your build.gradle:
```groovy
repositories {
    mavenLocal()
}

dependencies {
    implementation 'org.opensearch.protobufs:opensearch-protobufs:1.0.0'
}
```


# Protobuf Convert Tools

**ProtoConvertTools** consists of the following component
- **Preprocessing** Preprocess downloaded [OpenSearch API Specification](https://github.com/opensearch-project/opensearch-api-specification) before convert to Protobuf-schema.
- **Postprocessing** Postprocess the generated Protobuf files after OpenAPI to Proto conversion.

The [Spec Preprocessing](tools/proto-convert/src/PreProcessing.ts) includes two steps:

1. **Filter**
    - Filters only the target APIs defined in [target_api.yaml](tools/src/config/target_api.yaml).
    - Extract a single API per group from the OpenSearch spec.

2. **Sanitizer**
    - Normalizes schema and property names to be compatible with Protobuf naming rules.

**Setup**

1. Install [Node.js](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs)
2. Install project dependencies:


    npm run preprocessing -- --help 
**Arguments**

- `--input <path>`: The path read downloaded opensearch-api-specification yaml file, defaults to `<repository-root>/build/opensearch-openapi.yaml`.
- `--output <path>`: The path to write the final preprocessed spec to, defaults to `<repository-root>/build/processed-opensearch-openapi.yaml`.

**Example**

```bash
 npm run preprocessing  -i <input_path> -o <output_path>
```

# Ignored files

All generated files are excluded from version control via the `.gitignore` file. This includes:
- Bazel generated files (bazel-*)
- Generated files (generated/)
- Compiled class files (*.class)
- Package files (*.jar)
