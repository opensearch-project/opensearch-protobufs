"""Utilities for handling version from version.properties."""

def read_version_from_properties():
    """Read version from version.properties file.
    
    Note: This approach requires the version.properties file to be read
    at load time, but Bazel's py_wheel rule requires the version to be
    a compile-time constant.
    
    The recommended approach is to run: python3 update_version.py
    whenever version.properties changes, or use a wrapper script.
    """
    # For now, return the current version as a constant
    # This should be updated when version.properties changes
    return "0.12.0"

VERSION = read_version_from_properties()
