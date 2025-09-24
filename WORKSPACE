workspace(name = "proto_workspace")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

load("//:version_helper.bzl", "version_helper")
version_helper(
    name = "versioning",
)

"""
The version of rules_apple pulled in by com_github_grpc_grpc is missing a bugfix required
for bazel 7.x support. "'apple_common' value has no field or method 'multi_arch_split'".
See release notes: https://github.com/bazelbuild/rules_apple/releases/tag/3.0.0-rc1.
"""

http_archive(
    name = "build_bazel_rules_apple",
    sha256 = "20da675977cb8249919df14d0ce6165d7b00325fb067f0b06696b893b90a55e8",
    url = "https://github.com/bazelbuild/rules_apple/releases/download/3.0.0/rules_apple.3.0.0.tar.gz",
)

"""
Protoc compiler - 3.25.5 and associated C dependencies.
Includes some native support for language specific rules.
"""

http_archive(
    name = "com_google_absl",
    sha256 = "f50e5ac311a81382da7fa75b97310e4b9006474f9560ac46f54a9967f07d4ae3",
    strip_prefix = "abseil-cpp-20240722.0",
    urls = [
        "https://storage.googleapis.com/grpc-bazel-mirror/github.com/abseil/abseil-cpp/archive/20240722.0.tar.gz",
        "https://github.com/abseil/abseil-cpp/archive/20240722.0.tar.gz",
    ],
)

# Protobuf now managed by MODULE.bazel

"""
Pin compatible version of go language rules.
Overrides the version set in com_github_grpc_grpc.
"""

http_archive(
    name = "io_bazel_rules_go",
    sha256 = "6734a719993b1ba4ebe9806e853864395a8d3968ad27f9dd759c196b3eb3abe8",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/rules_go/releases/download/v0.45.1/rules_go-v0.45.1.zip",
        "https://github.com/bazelbuild/rules_go/releases/download/v0.45.1/rules_go-v0.45.1.zip",
    ],
)

"""
Official gRPC repo bazel dependencies.
We must match the version used in OS core exactly - 1.68.2.
"""

# gRPC now managed by MODULE.bazel

# Proto and gRPC rules now managed by MODULE.bazel

load("@io_bazel_rules_go//go:deps.bzl", "go_register_toolchains", "go_rules_dependencies")
go_rules_dependencies()
go_register_toolchains()

"""
Dependencies for java gRPC rules are sourced from maven.
"""

load("@rules_jvm_external//:defs.bzl", "maven_install")
load("@io_grpc_grpc_java//:repositories.bzl", "IO_GRPC_GRPC_JAVA_ARTIFACTS", "IO_GRPC_GRPC_JAVA_OVERRIDE_TARGETS", "grpc_java_repositories")

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
grpc_java_repositories()
