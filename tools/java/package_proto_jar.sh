#!/bin/bash
# Script to package generated Java proto files into a Maven-compatible JAR
set -e
# Configuration
ROOT_DIR="`dirname "$(realpath $0)"`/../.."
OUTPUT_DIR_ROOT="$ROOT_DIR/generated"
OUTPUT_DIR_MAVEN="$OUTPUT_DIR_ROOT/maven"
OUTPUT_DIR_JAVA="$OUTPUT_DIR_ROOT/java"
MAVEN_LOCAL_REPO="${HOME}/.m2/repository"

# Parameters
function usage() {
    echo "Usage: $0 [args]"
    echo ""
    echo "Arguments:"
    echo -e "-c CLEAN_GENERATED\t[Optional] default to 'false', set to 'true' will remove "
    echo -e "-s IS_SNAPSHOT\t[Optional] default to 'true', set to 'false' will generate official build artifacts."
    echo -e "-h help"
}

CLEAN_GENERATED='false'
IS_SNAPSHOT='true'

while getopts "c:s:h" opt; do
  case $opt in
    h)
      usage
      exit 1
      ;;
    c)
      CLEAN_GENERATED="$OPTARG"
      ;;
    s)
      IS_SNAPSHOT="$OPTARG"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      exit 1
      ;;
  esac
done

if [ "$CLEAN_GENERATED" = "true" ]; then
    echo "Cleanup $OUTPUT_DIR_ROOT"
    rm -rf "$OUTPUT_DIR_ROOT"
fi

if [ "$IS_SNAPSHOT" != "true" ] && [ "$IS_SNAPSHOT" != "false" ]; then
    echo "Error: IS_SNAPSHOT must be either 'true' or 'false', exit 1"
    exit 1
fi

VERSION=`$ROOT_DIR/gradlew -Dbuild.snapshot=$IS_SNAPSHOT properties | grep version: | awk '{print $2}'`
GROUP_ID=`$ROOT_DIR/gradlew properties | grep group: | awk '{print $2}'`
ARTIFACT_ID=`$ROOT_DIR/gradlew properties | grep artifactName: | awk '{print $2}'`
JAR_NAME="${ARTIFACT_ID}-${VERSION}.jar"
POM_NAME="${ARTIFACT_ID}-${VERSION}.pom"

if [ -z "$GROUP_ID" ] || [ -z "$ARTIFACT_ID" ] || [ -z "$VERSION" ]; then
    echo "GROUP_ID/ARTIFACT_ID/VERSION empty, exit 1"
    exit 1
fi
echo "$GROUP_ID $ARTIFACT_ID $VERSION"

# Set up directories
mkdir -p "${OUTPUT_DIR_MAVEN}/classes"
mkdir -p "${OUTPUT_DIR_MAVEN}/META-INF/maven/${GROUP_ID}/${ARTIFACT_ID}"

# Step 1: Generate Java files from proto files (if not already done)
if [ ! -d "$OUTPUT_DIR_JAVA" ] || [ -z "$(find "$OUTPUT_DIR_JAVA" -name '*.java')" ]; then
  echo "Generating Java files from proto files..."
  "$ROOT_DIR/tools/java/generate_java.sh"
fi


# Step 2: Download protobuf-java and gRPC dependencies if needed
PROTOBUF_VERSION="3.25.5"
GRPC_VERSION="1.68.2"
GUAVA_VERSION="33.2.1-jre"
JAVAX_ANNOTATION_VERSION="1.3.2"
PROTOBUF_JAR="${OUTPUT_DIR_MAVEN}/protobuf-java-${PROTOBUF_VERSION}.jar"
GRPC_STUB_JAR="${OUTPUT_DIR_MAVEN}/grpc-stub-${GRPC_VERSION}.jar"
GRPC_PROTOBUF_JAR="${OUTPUT_DIR_MAVEN}/grpc-protobuf-${GRPC_VERSION}.jar"
GRPC_CORE_JAR="${OUTPUT_DIR_MAVEN}/grpc-core-${GRPC_VERSION}.jar"
GRPC_API_JAR="${OUTPUT_DIR_MAVEN}/grpc-api-${GRPC_VERSION}.jar"
GUAVA_JAR="${OUTPUT_DIR_MAVEN}/guava-${GUAVA_VERSION}.jar"
JAVAX_ANNOTATION_JAR="${OUTPUT_DIR_MAVEN}/javax.annotation-api-${JAVAX_ANNOTATION_VERSION}.jar"

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

# Step 3: Compile Java files
echo "Compiling Java files..."
find "$OUTPUT_DIR_JAVA" -name "*.java" > "${OUTPUT_DIR_MAVEN}/sources.txt"
javac -cp "${PROTOBUF_JAR}:${GRPC_STUB_JAR}:${GRPC_PROTOBUF_JAR}:${GRPC_CORE_JAR}:${GRPC_API_JAR}:${GUAVA_JAR}:${JAVAX_ANNOTATION_JAR}" -d "${OUTPUT_DIR_MAVEN}/classes" @"${OUTPUT_DIR_MAVEN}/sources.txt"

# Step 3: Create POM file
echo "Creating POM file..."
cat > "${OUTPUT_DIR_MAVEN}/META-INF/maven/${GROUP_ID}/${ARTIFACT_ID}/pom.xml" << EOF
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
  <url>https://github.com/opensearch-project/opensearch-protobufs</url>
  <scm>
    <url>https://github.com/opensearch-project/opensearch-protobufs</url>
  </scm>
  <inceptionYear>2021</inceptionYear>
  <licenses>
    <license>
      <name>The Apache License, Version 2.0</name>
      <url>http://www.apache.org/licenses/LICENSE-2.0.txt</url>
    </license>
  </licenses>
  <developers>
    <developer>
      <name>OpenSearch</name>
      <url>https://github.com/opensearch-project/opensearch-protobufs</url>
    </developer>
  </developers>
</project>
EOF

# Create pom.properties file
cat > "${OUTPUT_DIR_MAVEN}/META-INF/maven/${GROUP_ID}/${ARTIFACT_ID}/pom.properties" << EOF
#Generated by package_proto_jar.sh
#$(date)
version=${VERSION}
groupId=${GROUP_ID}
artifactId=${ARTIFACT_ID}
EOF

# Step 4: Ensure Google Protobuf classes are excluded
echo "Ensuring Google Protobuf classes are excluded..."
rm -rf "${OUTPUT_DIR_MAVEN}/classes/com/google/protobuf"
rm -rf "${OUTPUT_DIR_MAVEN}/classes/google/protobuf"

# Step 5: Create JAR files
echo "Creating main JAR file..."
(cd "${OUTPUT_DIR_MAVEN}/classes" && jar cf "../${JAR_NAME}" .)
jar uf "${OUTPUT_DIR_MAVEN}/${JAR_NAME}" -C "${OUTPUT_DIR_MAVEN}" META-INF

# Create sources JAR
echo "Creating sources JAR file..."
SOURCES_JAR_NAME="${ARTIFACT_ID}-${VERSION}-sources.jar"
(cd "$OUTPUT_DIR_JAVA" && jar cf "${OUTPUT_DIR_MAVEN}/${SOURCES_JAR_NAME}" .)

# Create javadoc JAR
echo "Creating javadoc JAR file..."
JAVADOC_JAR_NAME="${ARTIFACT_ID}-${VERSION}-javadoc.jar"
JAVADOC_DIR="${OUTPUT_DIR_MAVEN}/javadoc"
mkdir -p "${JAVADOC_DIR}"

# Generate javadoc
echo "Generating javadoc..."
find "$OUTPUT_DIR_JAVA" -name "*.java" > "${OUTPUT_DIR_MAVEN}/javadoc_sources.txt"
javadoc -d "${JAVADOC_DIR}" -classpath "${PROTOBUF_JAR}:${GRPC_STUB_JAR}:${GRPC_PROTOBUF_JAR}:${GRPC_CORE_JAR}:${GRPC_API_JAR}:${GUAVA_JAR}:${JAVAX_ANNOTATION_JAR}" @"${OUTPUT_DIR_MAVEN}/javadoc_sources.txt" || echo "Javadoc generation had warnings, but continuing..."

# Package javadoc into JAR
(cd "${JAVADOC_DIR}" && jar cf "${OUTPUT_DIR_MAVEN}/${JAVADOC_JAR_NAME}" .)

# Step 6: Install to local Maven repository
echo "Installing to local Maven repository..."
GROUP_PATH=$(echo ${GROUP_ID} | tr '.' '/')
ARTIFACT_PATH="${MAVEN_LOCAL_REPO}/${GROUP_PATH}/${ARTIFACT_ID}/${VERSION}"
mkdir -p "${ARTIFACT_PATH}"

# Copy JAR files
cp "${OUTPUT_DIR_MAVEN}/${JAR_NAME}" "${ARTIFACT_PATH}/"
cp "${OUTPUT_DIR_MAVEN}/${SOURCES_JAR_NAME}" "${ARTIFACT_PATH}/"
cp "${OUTPUT_DIR_MAVEN}/${JAVADOC_JAR_NAME}" "${ARTIFACT_PATH}/"

# Copy POM file
cp "${OUTPUT_DIR_MAVEN}/META-INF/maven/${GROUP_ID}/${ARTIFACT_ID}/pom.xml" "${ARTIFACT_PATH}/${POM_NAME}"

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

echo "Done! JAR file created at ${OUTPUT_DIR_MAVEN}/${JAR_NAME}"
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

echo "Prepare publishing artifacts"
PUBLISH_DIR="$OUTPUT_DIR_MAVEN/publish"
rm -rf "$PUBLISH_DIR" && mkdir -p "$PUBLISH_DIR"
cp -v "${OUTPUT_DIR_MAVEN}/META-INF/maven/${GROUP_ID}/${ARTIFACT_ID}/pom.xml" "${PUBLISH_DIR}/${JAR_NAME%.jar}.pom" 
cp -v "${OUTPUT_DIR_MAVEN}/${JAR_NAME}" "${PUBLISH_DIR}"
cp -v "${OUTPUT_DIR_MAVEN}/${SOURCES_JAR_NAME}" "${PUBLISH_DIR}"
cp -v "${OUTPUT_DIR_MAVEN}/${JAVADOC_JAR_NAME}" "${PUBLISH_DIR}"

echo "Generated JAR files:"
echo "  Main JAR: ${OUTPUT_DIR_MAVEN}/${JAR_NAME}"
echo "  Sources JAR: ${OUTPUT_DIR_MAVEN}/${SOURCES_JAR_NAME}"
echo "  Javadoc JAR: ${OUTPUT_DIR_MAVEN}/${JAVADOC_JAR_NAME}"
