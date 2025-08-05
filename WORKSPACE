workspace(name = "proto_workspace")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

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

http_archive(
    name = "com_google_protobuf",
    sha256 = "4356e78744dfb2df3890282386c8568c85868116317d9b3ad80eb11c2aecf2ff",
    strip_prefix = "protobuf-3.25.5",
    urls = ["https://github.com/protocolbuffers/protobuf/archive/v3.25.5.tar.gz"],
)

load("@com_google_protobuf//:protobuf_deps.bzl", "protobuf_deps")
protobuf_deps()

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
Language and gRPC rules from the actively maintained rules-proto-grpc project.
Java language/gRPC rules.
Python language/gRPC rules.
"""

http_archive(
    name = "rules_proto_grpc",
    sha256 = "9ba7299c5eb6ec45b6b9a0ceb9916d0ab96789ac8218269322f0124c0c0d24e2",
    strip_prefix = "rules_proto_grpc-4.5.0",
    urls = ["https://github.com/rules-proto-grpc/rules_proto_grpc/releases/download/4.5.0/rules_proto_grpc-4.5.0.tar.gz"],
)

load("@rules_proto_grpc//:repositories.bzl", "rules_proto_grpc_repos", "rules_proto_grpc_toolchains")
rules_proto_grpc_repos()
rules_proto_grpc_toolchains()

"""
Official gRPC repo bazel dependencies.
Updated to gRPC 1.70.0 to address security vulnerabilities in Netty dependencies.
"""

http_archive(
    name = "com_github_grpc_grpc",
    strip_prefix = "grpc-1.70.0",
    urls = ["https://github.com/grpc/grpc/archive/v1.70.0.tar.gz"],
    sha256 = "3c95034f6b23ce7d286e2e7b5f3f4f223720b8bb3f5a9662ff96b7013b2c3c26",
)

load("@com_github_grpc_grpc//bazel:grpc_deps.bzl", "grpc_deps")
grpc_deps()

load("@com_github_grpc_grpc//bazel:grpc_extra_deps.bzl", "grpc_extra_deps")
grpc_extra_deps()

"""
Load language/gRPC rules last to ensure we pick up the correct protobuf and gRPC versions.
"""

load("@rules_proto//proto:repositories.bzl", "rules_proto_dependencies", "rules_proto_toolchains")
rules_proto_dependencies()
rules_proto_toolchains()

load("@rules_proto_grpc//python:repositories.bzl", rules_proto_grpc_python_repos = "python_repos")
rules_proto_grpc_python_repos()

load("@rules_proto_grpc//java:repositories.bzl", rules_proto_grpc_java_repos = "java_repos")
rules_proto_grpc_java_repos()

load("@rules_proto_grpc//go:repositories.bzl", rules_proto_grpc_go_repos = "go_repos")
rules_proto_grpc_go_repos()

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
