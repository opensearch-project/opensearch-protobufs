"""
This file acts as a hook for build scripts to automatically update `VERSION` as used in
the bazel build environment.
"""

def read_version_from_properties():
    return "0.12.0"

VERSION = read_version_from_properties()
