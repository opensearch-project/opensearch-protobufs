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

# Protobuf Local Convert Guide

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
