workspace(name = "proto_workspace")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")


"""
Protoc compiler - 3.25.5 and associated C dependencies.
Includes some native support for language specific rules.
Explicitely bind this dependency as packages may try to load alternate versions.
"""

http_archive(
    name = "com_google_absl",
    sha256 = "3c743204df78366ad2eaf236d6631d83f6bc928d1705dd0000b872e53b73dc6a",
    strip_prefix = "abseil-cpp-20240116.1",
    urls = ["https://github.com/abseil/abseil-cpp/archive/refs/tags/20240116.1.tar.gz"],
)

http_archive(
    name = "com_google_protobuf",
    sha256 = "4356e78744dfb2df3890282386c8568c85868116317d9b3ad80eb11c2aecf2ff",
    strip_prefix = "protobuf-3.25.5",
    urls = ["https://github.com/protocolbuffers/protobuf/archive/v3.25.5.tar.gz"],
)

load("@com_google_protobuf//:protobuf_deps.bzl", "protobuf_deps")

protobuf_deps()

bind(
    name = "protobuf",
    actual = "@com_google_protobuf//:protobuf",
)

# """
# Explicitely pin a recent version of com_google_googleapis to avoid compatibility issues.

# Latest py_proto_library definition fails with:
# `plugin attribute not supported`. 
# """

# http_archive(
#     name = "com_google_googleapis",
#     sha256 = "ec7e30c7082e6ae7ae41c2688137fa3d3cd4496badf970b2883f388a3c0103e6",
#     strip_prefix = "googleapis-cc6c360ec4509ef0288d5e2c85bd6ec1a3b1de83",
#     urls = ["https://github.com/googleapis/googleapis/archive/cc6c360ec4509ef0288d5e2c85bd6ec1a3b1de83.zip"],
# )

# load("@com_google_googleapis//:repository_rules.bzl", "switched_rules_by_language")
# switched_rules_by_language(
#     name = "com_google_googleapis_imports",
#     grpc = True,
#     python = True,
# )

# """
# Explicitely pin a compatible version of build_bazel_rules_apple.
# Does not appear to be a flag to disable this dependency and I goes un-used.

# Default version fails with:
# Error: 'apple_common' value has no field or method 'multi_arch_split'
# """

# http_archive(
#     name = "build_bazel_rules_apple",
#     sha256 = "9e26307516c4d5f2ad4aee90ac01eb8cd31f9b8d6ea93619fc64b3cbc81b0944",
#     url = "https://github.com/bazelbuild/rules_apple/releases/download/2.2.0/rules_apple.2.2.0.tar.gz",
# )


"""
Pin compatible version of go rules.
Referenced by both rules_proto_grpc and com_github_grpc_grpc.
"""

http_archive(
    name = "io_bazel_rules_go",
    sha256 = "6734a719993b1ba4ebe9806e853864395a8d3968ad27f9dd759c196b3eb3abe8",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/rules_go/releases/download/v0.45.1/rules_go-v0.45.1.zip",
        "https://github.com/bazelbuild/rules_go/releases/download/v0.45.1/rules_go-v0.45.1.zip",
    ],
)

# load("@io_bazel_rules_go//go:deps.bzl", "go_register_toolchains", "go_rules_dependencies")
# go_rules_dependencies()
# go_register_toolchains(version = "1.22.5")

# """
# Pinning more recent rules_cc to avoid compatibility issue with 'apple_common'.
# Error: 'apple_common' value has no field or method 'multi_arch_split'
# """

# http_archive(
#     name = "rules_cc",
#     sha256 = "35f2fb4ea0b3e61ad64a369de284e4fbbdcdba71836a5555abb5e194cf119509",
#     strip_prefix = "rules_cc-624b5d59dfb45672d4239422fa1e3de1822ee110",
#     urls = [
#         "https://github.com/bazelbuild/rules_cc/archive/624b5d59dfb45672d4239422fa1e3de1822ee110.tar.gz",
#     ],
# )

"""
Official gRPC bazel dependencies.
We must match the version used in OS core exactly - 1.68.2.
"""

http_archive(
    name = "com_github_grpc_grpc",
    strip_prefix = "grpc-1.68.2",
    urls = ["https://github.com/grpc/grpc/archive/v1.68.2.tar.gz"],
    sha256 = "afbc5d78d6ba6d509cc6e264de0d49dcd7304db435cbf2d630385bacf49e066c",
    patches = [
        "//bazel:grpc_build_system.patch",
        "//bazel:grpc_extra_deps.patch",
    ],
    patch_args = ["-p1"],
)

load("@com_github_grpc_grpc//bazel:grpc_deps.bzl", "grpc_deps")
grpc_deps()

load("@com_github_grpc_grpc//bazel:grpc_extra_deps.bzl", "grpc_extra_deps")
grpc_extra_deps()

"""
Alternate third party resource with up to date rules for python.
Includes python protobuf and gRPC rules. 
"""

http_archive(
    name = "rules_proto_grpc",
    sha256 = "9ba7299c5eb6ec45b6b9a0ceb9916d0ab96789ac8218269322f0124c0c0d24e2",
    strip_prefix = "rules_proto_grpc-4.5.0",
    urls = ["https://github.com/rules-proto-grpc/rules_proto_grpc/releases/download/4.5.0/rules_proto_grpc-4.5.0.tar.gz"],
)

load("@rules_proto_grpc//:repositories.bzl", "rules_proto_grpc_repos", "rules_proto_grpc_toolchains")
rules_proto_grpc_toolchains()
rules_proto_grpc_repos()

load("@rules_proto//proto:repositories.bzl", "rules_proto_dependencies", "rules_proto_toolchains")
rules_proto_dependencies()
rules_proto_toolchains()

load("@rules_proto_grpc//python:repositories.bzl", rules_proto_grpc_python_repos = "python_repos")
rules_proto_grpc_python_repos()