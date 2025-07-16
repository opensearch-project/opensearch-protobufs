# Prerequisites
Install bazel, using the version in .bazelversion.

# Compile protos and grpc

## All artifacts
```
bazel build //...
```

## Java
```
bazel build //:java_protos_all
```

## Python
```
bazel build //:python_protos_all
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
    url = 'https://central.sonatype.com/repository/maven-snapshots/'
  }
}

dependencies {
    implementation 'org.opensearch.protobufs:opensearch-protobufs:{VERSION}-SNAPSHOT'
}
```


# Protobuf Convert Process

**ProtoConvertProcess** consists of the following steps:
- **Preprocessing** Preprocess downloaded [OpenSearch API Specification](https://github.com/opensearch-project/opensearch-api-specification) before convert to Protobuf-schema.
- **Conversion** The prepared API specification is transformed into a Protobuf schema using [openapi-generator](https://github.com/OpenAPITools/openapi-generator).
- **Postprocessing** The resulting Protobuf files are refined and adjusted to meet the standards after the conversion.

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

**openapi-generator**

OpenAPI Generator offers a range of configuration options. The configuration is specified in the [protobuf-generator-config.yaml](tools/proto-convert/src/config/protobuf-generator-config.yaml).
OpenAPI Generator supports the customization of mustache templates to generate the desired output, with the templates located in [protobuf-schema-template](tools/proto-convert/src/config/protobuf-schema-template)
# Ignored files

All generated files are excluded from version control via the `.gitignore` file. This includes:
- Bazel generated files (bazel-*)
- Generated files (generated/)
- Compiled class files (*.class)
- Package files (*.jar)
