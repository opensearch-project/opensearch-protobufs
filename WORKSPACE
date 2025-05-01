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
Language rules.
Includes libraries required for compilation/linking compiled protos.
Includes language specfic platoform support (JMV, python interpreter). 
"""

# Java
http_archive(
    name = "rules_java",
    sha256 = "f8ae9ed3887df02f40de9f4f7ac3873e6dd7a471f9cddf63952538b94b59aeb3",
    urls = [
        "https://github.com/bazelbuild/rules_java/releases/download/7.6.1/rules_java-7.6.1.tar.gz",
    ],
)

# Proto rules
http_archive(
    name = "rules_proto",
    sha256 = "37005d35aba73a843b34f194c0c41633a0b2fd90f8b84c91b391b995ffc593f2",
    strip_prefix = "rules_proto-5.3.0-21.7",
    urls = ["https://github.com/bazelbuild/rules_proto/archive/refs/tags/5.3.0-21.7.zip"],
)

load("@rules_proto//proto:repositories.bzl", "rules_proto_dependencies", "rules_proto_toolchains")

rules_proto_dependencies()

rules_proto_toolchains()

# Add rules_proto_grpc
http_archive(
    name = "rules_proto_grpc",
    sha256 = "9ba7299c5eb6ec45b6b9a0ceb9916d0ab96789ac8218269322f0124c0c0d24e2",
    strip_prefix = "rules_proto_grpc-4.5.0",
    urls = ["https://github.com/rules-proto-grpc/rules_proto_grpc/releases/download/4.5.0/rules_proto_grpc-4.5.0.tar.gz"],
)

load("@rules_proto_grpc//:repositories.bzl", "rules_proto_grpc_toolchains", "rules_proto_grpc_repos")
rules_proto_grpc_toolchains()
rules_proto_grpc_repos()

load("@rules_proto_grpc//python:repositories.bzl", rules_proto_grpc_python_repos = "python_repos")
rules_proto_grpc_python_repos()

"""
Service definitions need additional gRPC dependencies.
Defined for each language. 
"""

# Java
http_archive(
    name = "io_grpc_grpc_java",
    sha256 = "dc1ad2272c1442075c59116ec468a7227d0612350c44401237facd35aab15732",
    strip_prefix = "grpc-java-1.68.2",
    urls = ["https://github.com/grpc/grpc-java/archive/v1.68.2.tar.gz"],
)

load("@io_grpc_grpc_java//:repositories.bzl", "IO_GRPC_GRPC_JAVA_ARTIFACTS", "IO_GRPC_GRPC_JAVA_OVERRIDE_TARGETS", "grpc_java_repositories")

grpc_java_repositories()

# Python
http_archive(
    name = "com_github_grpc_grpc",
    strip_prefix = "grpc-1.72.0",
    urls = ["https://github.com/grpc/grpc/archive/v1.72.0.tar.gz"],
    sha256 = "4a8aa99d5e24f80ea6b7ec95463e16af5bd91aa805e26c661ef6491ae3d2d23c",
)

load("@com_github_grpc_grpc//bazel:grpc_deps.bzl", "grpc_deps")
grpc_deps()

load("@com_github_grpc_grpc//bazel:grpc_extra_deps.bzl", "grpc_extra_deps")
grpc_extra_deps()

load("@com_github_grpc_grpc//bazel:grpc_python_deps.bzl", "grpc_python_deps")
grpc_python_deps()

# Use rules_jvm_external to manage Maven dependencies
http_archive(
    name = "rules_jvm_external",
    sha256 = "62133c125bf4109dfd9d2af64830208356ce4ef8b165a6ef15bbff7460b35c3a",
    strip_prefix = "rules_jvm_external-3.0",
    url = "https://github.com/bazelbuild/rules_jvm_external/archive/3.0.zip",
)

load("@rules_jvm_external//:defs.bzl", "maven_install")

maven_install(
    artifacts = IO_GRPC_GRPC_JAVA_ARTIFACTS + [
        "io.netty:netty-handler:4.1.118.Final",
        "commons-codec:commons-codec:1.13",
        "org.jetbrains.kotlin:kotlin-stdlib:1.6.0",
        "com.google.protobuf:protobuf-java:3.25.5",
        "com.squareup.okio:okio:3.4.0",
    ],
    generate_compat_repositories = True,
    override_targets = IO_GRPC_GRPC_JAVA_OVERRIDE_TARGETS,
    repositories = [
        "https://repo.maven.apache.org/maven2/",
    ],
)

load("@maven//:compat.bzl", "compat_repositories")

compat_repositories()
