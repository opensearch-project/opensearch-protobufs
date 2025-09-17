"""Helper to read VERSION into bazel from version.properties."""

def _parse_version(content):
    for line in content.splitlines():
        if line.startswith("version="):
            return line.split("=")[1].strip()
    return "0.0.0"

def _version_impl(repository_ctx):
    version_file_path = repository_ctx.path(Label("//:version.properties"))
    version_file_contents = repository_ctx.read(version_file_path)
    version = _parse_version(version_file_contents)

    repository_ctx.file("BUILD", content = "")
    repository_ctx.file(
        "version.bzl",
        content = 'VERSION = "{}"'.format(version)
    )

version_helper = repository_rule(
    implementation = _version_impl,
)