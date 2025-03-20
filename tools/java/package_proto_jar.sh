#!/bin/bash
# Script to package generated Java proto files into a Maven-compatible JAR

# Configuration
GROUP_ID="org.opensearch.protobuf"
ARTIFACT_ID="opensearch-protobuf"
VERSION="1.0.0"
JAR_NAME="${ARTIFACT_ID}-${VERSION}.jar"
POM_NAME="${ARTIFACT_ID}-${VERSION}.pom"
OUTPUT_DIR="generated/maven"
MAVEN_LOCAL_REPO="${HOME}/.m2/repository"

# Set up directories
mkdir -p "${OUTPUT_DIR}/classes"
mkdir -p "${OUTPUT_DIR}/META-INF/maven/${GROUP_ID}/${ARTIFACT_ID}"

# Step 1: Generate Java files from proto files (if not already done)
if [ ! -d "generated/java" ] || [ -z "$(find generated/java -name '*.java')" ]; then
  echo "Generating Java files from proto files..."
  ./tools/java/generate_java.sh
fi

# Step 1.5: Generate gRPC stubs (if not already done)
if [ ! -f "generated/java/opensearch/proto/services/DocumentServiceGrpc.java" ] || [ ! -f "generated/java/opensearch/proto/services/SearchServiceGrpc.java" ]; then
  echo "Generating gRPC stubs..."
  ./tools/java/generate_grpc_java.sh
fi

# Step 2: Download protobuf-java and gRPC dependencies if needed
PROTOBUF_VERSION="3.25.5"
GRPC_VERSION="1.38.0"
GUAVA_VERSION="31.0.1-jre"
JAVAX_ANNOTATION_VERSION="1.3.2"
PROTOBUF_JAR="${OUTPUT_DIR}/protobuf-java-${PROTOBUF_VERSION}.jar"
GRPC_STUB_JAR="${OUTPUT_DIR}/grpc-stub-${GRPC_VERSION}.jar"
GRPC_PROTOBUF_JAR="${OUTPUT_DIR}/grpc-protobuf-${GRPC_VERSION}.jar"
GRPC_CORE_JAR="${OUTPUT_DIR}/grpc-core-${GRPC_VERSION}.jar"
GRPC_API_JAR="${OUTPUT_DIR}/grpc-api-${GRPC_VERSION}.jar"
GUAVA_JAR="${OUTPUT_DIR}/guava-${GUAVA_VERSION}.jar"
JAVAX_ANNOTATION_JAR="${OUTPUT_DIR}/javax.annotation-api-${JAVAX_ANNOTATION_VERSION}.jar"

if [ ! -f "${PROTOBUF_JAR}" ]; then
  echo "Downloading protobuf-java dependency..."
  curl -s -o "${PROTOBUF_JAR}" "https://repo1.maven.org/maven2/com/google/protobuf/protobuf-java/${PROTOBUF_VERSION}/protobuf-java-${PROTOBUF_VERSION}.jar"
fi

if [ ! -f "${GRPC_STUB_JAR}" ]; then
  echo "Downloading gRPC stub dependency..."
  curl -s -o "${GRPC_STUB_JAR}" "https://repo1.maven.org/maven2/io/grpc/grpc-stub/${GRPC_VERSION}/grpc-stub-${GRPC_VERSION}.jar"
fi

if [ ! -f "${GRPC_PROTOBUF_JAR}" ]; then
  echo "Downloading gRPC protobuf dependency..."
  curl -s -o "${GRPC_PROTOBUF_JAR}" "https://repo1.maven.org/maven2/io/grpc/grpc-protobuf/${GRPC_VERSION}/grpc-protobuf-${GRPC_VERSION}.jar"
fi

if [ ! -f "${GRPC_CORE_JAR}" ]; then
  echo "Downloading gRPC core dependency..."
  curl -s -o "${GRPC_CORE_JAR}" "https://repo1.maven.org/maven2/io/grpc/grpc-core/${GRPC_VERSION}/grpc-core-${GRPC_VERSION}.jar"
fi

if [ ! -f "${GRPC_API_JAR}" ]; then
  echo "Downloading gRPC API dependency..."
  curl -s -o "${GRPC_API_JAR}" "https://repo1.maven.org/maven2/io/grpc/grpc-api/${GRPC_VERSION}/grpc-api-${GRPC_VERSION}.jar"
fi

if [ ! -f "${GUAVA_JAR}" ]; then
  echo "Downloading Guava dependency..."
  curl -s -o "${GUAVA_JAR}" "https://repo1.maven.org/maven2/com/google/guava/guava/${GUAVA_VERSION}/guava-${GUAVA_VERSION}.jar"
fi

if [ ! -f "${JAVAX_ANNOTATION_JAR}" ]; then
  echo "Downloading javax.annotation dependency..."
  curl -s -o "${JAVAX_ANNOTATION_JAR}" "https://repo1.maven.org/maven2/javax/annotation/javax.annotation-api/${JAVAX_ANNOTATION_VERSION}/javax.annotation-api-${JAVAX_ANNOTATION_VERSION}.jar"
fi

# # Step 2.5: Fix method signature clashes in generated code
# echo "Fixing method signature clashes in generated code..."
# # Create a backup of the original file
# cp generated/java/com/google/protobuf/DescriptorProtos.java generated/java/com/google/protobuf/DescriptorProtos.java.bak

# # Remove @Override annotations and fix method signatures for clearExtension methods
# sed -i 's/@java.lang.Override\s*public <Type> Builder clearExtension(/public Builder clearExtension(/g' generated/java/com/google/protobuf/DescriptorProtos.java

# Step 3: Compile Java files
echo "Compiling Java files..."
find generated/java -name "*.java" > "${OUTPUT_DIR}/sources.txt"
javac -cp "${PROTOBUF_JAR}:${GRPC_STUB_JAR}:${GRPC_PROTOBUF_JAR}:${GRPC_CORE_JAR}:${GRPC_API_JAR}:${GUAVA_JAR}:${JAVAX_ANNOTATION_JAR}" -d "${OUTPUT_DIR}/classes" @"${OUTPUT_DIR}/sources.txt"

# Step 3: Create POM file
echo "Creating POM file..."
cat > "${OUTPUT_DIR}/META-INF/maven/${GROUP_ID}/${ARTIFACT_ID}/pom.xml" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${GROUP_ID}</groupId>
  <artifactId>${ARTIFACT_ID}</artifactId>
  <version>${VERSION}</version>
  <name>OpenSearch Protocol Buffers</name>
  <description>Protocol Buffer definitions for OpenSearch</description>

  <dependencies>
    <dependency>
      <groupId>com.google.protobuf</groupId>
      <artifactId>protobuf-java</artifactId>
      <version>${PROTOBUF_VERSION}</version>
    </dependency>
    <dependency>
      <groupId>io.grpc</groupId>
      <artifactId>grpc-stub</artifactId>
      <version>${GRPC_VERSION}</version>
    </dependency>
    <dependency>
      <groupId>io.grpc</groupId>
      <artifactId>grpc-protobuf</artifactId>
      <version>${GRPC_VERSION}</version>
    </dependency>
    <dependency>
      <groupId>io.grpc</groupId>
      <artifactId>grpc-core</artifactId>
      <version>${GRPC_VERSION}</version>
    </dependency>
    <dependency>
      <groupId>io.grpc</groupId>
      <artifactId>grpc-api</artifactId>
      <version>${GRPC_VERSION}</version>
    </dependency>
    <dependency>
      <groupId>com.google.guava</groupId>
      <artifactId>guava</artifactId>
      <version>${GUAVA_VERSION}</version>
    </dependency>
    <dependency>
      <groupId>javax.annotation</groupId>
      <artifactId>javax.annotation-api</artifactId>
      <version>${JAVAX_ANNOTATION_VERSION}</version>
    </dependency>
  </dependencies>
</project>
EOF

# Create pom.properties file
cat > "${OUTPUT_DIR}/META-INF/maven/${GROUP_ID}/${ARTIFACT_ID}/pom.properties" << EOF
#Generated by package_proto_jar.sh
#$(date)
version=${VERSION}
groupId=${GROUP_ID}
artifactId=${ARTIFACT_ID}
EOF

# Step 4: Create JAR file
echo "Creating JAR file..."
(cd "${OUTPUT_DIR}/classes" && jar cf "../${JAR_NAME}" .)
jar uf "${OUTPUT_DIR}/${JAR_NAME}" -C "${OUTPUT_DIR}" META-INF

# Step 5: Install to local Maven repository
echo "Installing to local Maven repository..."
GROUP_PATH=$(echo ${GROUP_ID} | tr '.' '/')
ARTIFACT_PATH="${MAVEN_LOCAL_REPO}/${GROUP_PATH}/${ARTIFACT_ID}/${VERSION}"
mkdir -p "${ARTIFACT_PATH}"

# Copy JAR file
cp "${OUTPUT_DIR}/${JAR_NAME}" "${ARTIFACT_PATH}/"

# Copy POM file
cp "${OUTPUT_DIR}/META-INF/maven/${GROUP_ID}/${ARTIFACT_ID}/pom.xml" "${ARTIFACT_PATH}/${POM_NAME}"

# Create maven-metadata.xml file if it doesn't exist
METADATA_DIR="${MAVEN_LOCAL_REPO}/${GROUP_PATH}/${ARTIFACT_ID}"
if [ ! -f "${METADATA_DIR}/maven-metadata.xml" ]; then
  cat > "${METADATA_DIR}/maven-metadata.xml" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<metadata>
  <groupId>${GROUP_ID}</groupId>
  <artifactId>${ARTIFACT_ID}</artifactId>
  <versioning>
    <release>${VERSION}</release>
    <versions>
      <version>${VERSION}</version>
    </versions>
    <lastUpdated>$(date +%Y%m%d%H%M%S)</lastUpdated>
  </versioning>
</metadata>
EOF
else
  # Update the existing maven-metadata.xml file
  TEMP_FILE=$(mktemp)
  cat > "${TEMP_FILE}" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<metadata>
  <groupId>${GROUP_ID}</groupId>
  <artifactId>${ARTIFACT_ID}</artifactId>
  <versioning>
    <release>${VERSION}</release>
    <versions>
      <version>${VERSION}</version>
    </versions>
    <lastUpdated>$(date +%Y%m%d%H%M%S)</lastUpdated>
  </versioning>
</metadata>
EOF
  mv "${TEMP_FILE}" "${METADATA_DIR}/maven-metadata.xml"
fi

echo "Done! JAR file created at ${OUTPUT_DIR}/${JAR_NAME}"
echo "Installed to local Maven repository at ${ARTIFACT_PATH}"
echo ""
echo "To use this JAR in a Gradle project, add the following to your build.gradle:"
echo ""
echo "repositories {"
echo "    mavenLocal()"
echo "}"
echo ""
echo "dependencies {"
echo "    implementation '${GROUP_ID}:${ARTIFACT_ID}:${VERSION}'"
echo "}"
