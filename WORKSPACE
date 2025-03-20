workspace(name = "proto_workspace")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

# Protocol Buffers dependencies
http_archive(
    name = "com_google_protobuf",
    sha256 = "4356e78744dfb2df3890282386c8568c85868116317d9b3ad80eb11c2aecf2ff",
    strip_prefix = "protobuf-3.25.5",
    urls = ["https://github.com/protocolbuffers/protobuf/archive/v3.25.5.tar.gz"],
)

load("@com_google_protobuf//:protobuf_deps.bzl", "protobuf_deps")
protobuf_deps()

# Java rules
http_archive(
    name = "rules_java",
    sha256 = "220b87d8cfabd22d1c6d8e3cdb4249abd4c93dcc152e0667db061fb1b957ee68",
    urls = ["https://github.com/bazelbuild/rules_java/releases/download/0.1.1/rules_java-0.1.1.tar.gz"],
)

load("@rules_java//java:repositories.bzl", "rules_java_dependencies")
rules_java_dependencies()

# Proto rules
http_archive(
    name = "rules_proto",
    sha256 = "66bfdf8782796239d3875d37e7de19b1d94301e8972b3cbd2446b332429b4df1",
    strip_prefix = "rules_proto-4.0.0",
    urls = ["https://github.com/bazelbuild/rules_proto/archive/refs/tags/4.0.0.zip"],
)

load("@rules_proto//proto:repositories.bzl", "rules_proto_dependencies", "rules_proto_toolchains")
rules_proto_dependencies()
rules_proto_toolchains()

# gRPC dependencies
http_archive(
    name = "io_grpc_grpc_java",
    sha256 = "c454e068bfb5d0b5bdb5e3d7e32cd1fc34aaf22202855e29e048f3ad338e57b2",
    strip_prefix = "grpc-java-1.38.0",
    urls = ["https://github.com/grpc/grpc-java/archive/v1.38.0.tar.gz"],
)

load("@io_grpc_grpc_java//:repositories.bzl", "grpc_java_repositories")
grpc_java_repositories()

# Additional dependencies for gRPC Java
http_archive(
    name = "com_google_code_findbugs_jsr305",
    build_file = "@io_grpc_grpc_java//third_party:jsr305.BUILD",
    sha256 = "766ad2a0783f2687962c8ad74ceecc38a28b9f72a2d085ee438b7813e928d0c7",
    urls = ["https://repo1.maven.org/maven2/com/google/code/findbugs/jsr305/3.0.2/jsr305-3.0.2.jar"],
)

http_archive(
    name = "com_google_guava_guava",
    build_file = "@io_grpc_grpc_java//third_party:guava.BUILD",
    sha256 = "36a666e3b71ae7f0f0dca23654b67e086e6c93d192f60ba5dfd5519db6c288c8",
    urls = ["https://repo1.maven.org/maven2/com/google/guava/guava/31.0.1-jre/guava-31.0.1-jre.jar"],
)
