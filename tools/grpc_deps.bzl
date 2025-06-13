load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

def _grpc_deps_impl(ctx):
    http_archive(
        name = "grpc_java",
        sha256 = "dc1ad2272c1442075c59116ec468a7227d0612350c44401237facd35aab15732",
        strip_prefix = "grpc-java-1.68.2",
        urls = ["https://github.com/grpc/grpc-java/archive/v1.68.2.tar.gz"],
    )
grpc_deps = module_extension(
    implementation = _grpc_deps_impl,
)