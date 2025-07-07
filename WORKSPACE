workspace(name = "proto_workspace")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

"""
Explicitely pin a recent version of com_google_googleapis to avoid compatibility issues.

Latest py_proto_library definition fails with:
`plugin attribute not supported`. 
"""

http_archive(
    name = "com_google_googleapis",
    sha256 = "ec7e30c7082e6ae7ae41c2688137fa3d3cd4496badf970b2883f388a3c0103e6",
    strip_prefix = "googleapis-cc6c360ec4509ef0288d5e2c85bd6ec1a3b1de83",
    urls = ["https://github.com/googleapis/googleapis/archive/cc6c360ec4509ef0288d5e2c85bd6ec1a3b1de83.zip"],
)

load("@com_google_googleapis//:repository_rules.bzl", "switched_rules_by_language")
switched_rules_by_language(
    name = "com_google_googleapis_imports",
    grpc = True,
    python = True,
)

"""
Explicitely pin a compatible version of build_bazel_rules_apple.
Does not appear to be a flag to disable this dependency and I goes un-used.

Default version fails with:
Error: 'apple_common' value has no field or method 'multi_arch_split'
"""

http_archive(
    name = "build_bazel_rules_apple",
    sha256 = "9e26307516c4d5f2ad4aee90ac01eb8cd31f9b8d6ea93619fc64b3cbc81b0944",
    url = "https://github.com/bazelbuild/rules_apple/releases/download/2.2.0/rules_apple.2.2.0.tar.gz",
)


"""
rules_proto_grpc and com_github_grpc_grpc attempt to load `go_register_toolchains`.
Which fails with:
version set after go sdk rule declared (go_sdk)
Call `go_register_toolchains` up front for correct ordering.
"""

http_archive(
    name = "io_bazel_rules_go",
    sha256 = "6734a719993b1ba4ebe9806e853864395a8d3968ad27f9dd759c196b3eb3abe8",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/rules_go/releases/download/v0.45.1/rules_go-v0.45.1.zip",
        "https://github.com/bazelbuild/rules_go/releases/download/v0.45.1/rules_go-v0.45.1.zip",
    ],
)

load("@io_bazel_rules_go//go:deps.bzl", "go_register_toolchains", "go_rules_dependencies")
go_rules_dependencies()
go_register_toolchains(version = "1.22.5")

"""
Pinning more recent rules_cc to avoid compatibility issue with 'apple_common'.
Error: 'apple_common' value has no field or method 'multi_arch_split'
"""

http_archive(
    name = "rules_cc",
    sha256 = "35f2fb4ea0b3e61ad64a369de284e4fbbdcdba71836a5555abb5e194cf119509",
    strip_prefix = "rules_cc-624b5d59dfb45672d4239422fa1e3de1822ee110",
    urls = [
        "https://github.com/bazelbuild/rules_cc/archive/624b5d59dfb45672d4239422fa1e3de1822ee110.tar.gz",
    ],
)

"""
Protoc compiler - 3.25.5 and associated C dependencies.
Includes native support for language specific rules.
"""

http_archive(
    name = "com_google_protobuf",
    sha256 = "4356e78744dfb2df3890282386c8568c85868116317d9b3ad80eb11c2aecf2ff",
    strip_prefix = "protobuf-3.25.5",
    urls = ["https://github.com/protocolbuffers/protobuf/archive/v3.25.5.tar.gz"],
)

load("@com_google_protobuf//:protobuf_deps.bzl", "protobuf_deps")

protobuf_deps()

"""
gRPC 1.68.2.
"""

http_archive(
    name = "com_github_grpc_grpc",
    strip_prefix = "grpc-1.68.2",
    urls = ["https://github.com/grpc/grpc/archive/v1.68.2.tar.gz"],
    sha256 = "afbc5d78d6ba6d509cc6e264de0d49dcd7304db435cbf2d630385bacf49e066c",
    patches = ["//bazel:grpc_build_system.patch"],
    patch_args = ["-p1"],
)

load("@com_github_grpc_grpc//bazel:grpc_deps.bzl", "grpc_deps")
grpc_deps()

load("@com_github_grpc_grpc//bazel:grpc_extra_deps.bzl", "grpc_extra_deps")
grpc_extra_deps()

"""
Language rules.
Includes libraries required for compilation/linking compiled protos.
Includes language specfic platoform support (JMV, python interpreter). 
"""

# Python

# http_archive(
#     name = "upb",
#     sha256 = "538dd574dfe65875b76de9922f1c3117157d318a515fdf0644ccd6cf2be49940",
#     strip_prefix = "upb-1.0.0",
#     urls = ["https://github.com/protocolbuffers/upb/archive/refs/tags/v1.0.0.tar.gz"],
# )

# Python rules and dependencies
http_archive(
    name = "rules_python",
    sha256 = "fa532d635f29c038a64c8062724af700c30cf6b31174dd4fac120bc561a1a560",
    strip_prefix = "rules_python-1.5.1",
    url = "https://github.com/bazel-contrib/rules_python/releases/download/1.5.1/rules_python-1.5.1.tar.gz",
)

load("@rules_python//python:repositories.bzl", "py_repositories")
py_repositories()

load("@com_github_grpc_grpc//bazel:grpc_python_deps.bzl", "grpc_python_deps")
grpc_python_deps()