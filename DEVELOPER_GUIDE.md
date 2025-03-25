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

# Ignored files

All generated files are excluded from version control via the `.gitignore` file. This includes:
- Bazel generated files (bazel-*)
- Generated files (generated/)
- Compiled class files (*.class)
- Package files (*.jar)
