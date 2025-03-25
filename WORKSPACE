workspace(name = "proto_workspace")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

# Protocol Buffers dependencies
http_archive(
    name = "com_google_protobuf",
    sha256 = "946ba5371e423e1220d2cbefc1f65e69a1e81ca5bab62a03d66894172983cfcd",
    strip_prefix = "protobuf-3.12.0",
    urls = ["https://github.com/protocolbuffers/protobuf/archive/v3.12.0.tar.gz"],
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

# Use rules_jvm_external to manage Maven dependencies
http_archive(
    name = "rules_jvm_external",
    sha256 = "62133c125bf4109dfd9d2af64830208356ce4ef8b165a6ef15bbff7460b35c3a",
    strip_prefix = "rules_jvm_external-3.0",
    url = "https://github.com/bazelbuild/rules_jvm_external/archive/3.0.zip",
)

load("@rules_jvm_external//:defs.bzl", "maven_install")
load("@io_grpc_grpc_java//:repositories.bzl", "IO_GRPC_GRPC_JAVA_ARTIFACTS")
load("@io_grpc_grpc_java//:repositories.bzl", "IO_GRPC_GRPC_JAVA_OVERRIDE_TARGETS")

maven_install(
    artifacts = IO_GRPC_GRPC_JAVA_ARTIFACTS,
    generate_compat_repositories = True,
    override_targets = IO_GRPC_GRPC_JAVA_OVERRIDE_TARGETS,
    repositories = [
        "https://repo.maven.apache.org/maven2/",
    ],
)

load("@maven//:compat.bzl", "compat_repositories")
compat_repositories()
