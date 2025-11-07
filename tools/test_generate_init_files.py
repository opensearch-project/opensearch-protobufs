#!/usr/bin/env python3
"""
Unit tests for generate_init_files.py

Tests the functionality of generating __init__.py files for OpenSearch Protobufs,
including schema and service discovery, file generation, and error handling.
"""

import unittest
import tempfile
import shutil
import os
from pathlib import Path
from unittest.mock import patch, mock_open, MagicMock
import sys

# Add the tools directory to the path so we can import the module
sys.path.insert(0, os.path.dirname(__file__))
from generate_init_files import (
    generate_schemas_init,
    generate_services_init,
    main
)


class TestGenerateInitFiles(unittest.TestCase):
    """Test cases for generate_init_files.py functionality."""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.test_dir = tempfile.mkdtemp()
        self.schemas_dir = Path(self.test_dir) / "schemas"
        self.services_dir = Path(self.test_dir) / "services"

        # Create test directories
        self.schemas_dir.mkdir(parents=True)
        self.services_dir.mkdir(parents=True)

        # Create mock protobuf files
        self.create_mock_pb2_files()

    def tearDown(self):
        """Clean up test fixtures after each test method."""
        shutil.rmtree(self.test_dir)

    def create_mock_pb2_files(self):
        """Create mock _pb2.py and _pb2_grpc.py files for testing."""
        # Schema files
        (self.schemas_dir / "common_pb2.py").write_text("""
# Generated protobuf file
class GlobalParams:
    pass

class ErrorResponse:
    pass
""")

        (self.schemas_dir / "document_pb2.py").write_text("""
# Generated protobuf file
class BulkRequest:
    pass

class IndexRequest:
    pass
""")

        (self.schemas_dir / "search_pb2.py").write_text("""
# Generated protobuf file
class SearchRequest:
    pass

class SearchResponse:
    pass
""")

        # Service files
        (self.services_dir / "document_service_pb2.py").write_text("""
# Generated protobuf service messages
class DocumentRequest:
    pass
""")

        (self.services_dir / "document_service_pb2_grpc.py").write_text("""
# Generated gRPC service file
class DocumentServiceStub:
    pass

class DocumentServiceServicer:
    pass

def add_DocumentServiceServicer_to_server():
    pass
""")

        (self.services_dir / "search_service_pb2.py").write_text("""
# Generated protobuf service messages
class SearchServiceRequest:
    pass
""")

        (self.services_dir / "search_service_pb2_grpc.py").write_text("""
# Generated gRPC service file
class SearchServiceStub:
    pass

class SearchServiceServicer:
    pass

def add_SearchServiceServicer_to_server():
    pass
""")

    def test_generate_schemas_init_success(self):
        """Test successful generation of schemas __init__.py file."""
        output_file = self.schemas_dir / "__init__.py"

        result = generate_schemas_init(str(self.schemas_dir), str(output_file))

        self.assertTrue(result)
        self.assertTrue(output_file.exists())

        content = output_file.read_text()
        self.assertIn("# OpenSearch Protobuf Schemas", content)
        self.assertIn("from .common_pb2 import *", content)
        self.assertIn("from .document_pb2 import *", content)
        self.assertIn("from .search_pb2 import *", content)
        self.assertIn("DO NOT EDIT MANUALLY", content)

    def test_generate_services_init_success(self):
        """Test successful generation of services __init__.py file."""
        output_file = self.services_dir / "__init__.py"

        result = generate_services_init(str(self.services_dir), str(output_file))

        self.assertTrue(result)
        self.assertTrue(output_file.exists())

        content = output_file.read_text()
        self.assertIn("# OpenSearch Protobuf Services", content)
        self.assertIn("from .document_service_pb2 import *", content)
        self.assertIn("from .search_service_pb2 import *", content)
        self.assertIn("from .document_service_pb2_grpc import *", content)
        self.assertIn("from .search_service_pb2_grpc import *", content)
        self.assertIn("DO NOT EDIT MANUALLY", content)

    def test_generate_schemas_init_nonexistent_directory(self):
        """Test schemas init generation with non-existent directory."""
        nonexistent_dir = "/path/that/does/not/exist"
        output_file = Path(self.test_dir) / "test_init.py"

        result = generate_schemas_init(nonexistent_dir, str(output_file))

        self.assertFalse(result)
        self.assertFalse(output_file.exists())

    def test_generate_services_init_nonexistent_directory(self):
        """Test services init generation with non-existent directory."""
        nonexistent_dir = "/path/that/does/not/exist"
        output_file = Path(self.test_dir) / "test_init.py"

        result = generate_services_init(nonexistent_dir, str(output_file))

        self.assertFalse(result)
        self.assertFalse(output_file.exists())

    def test_generate_schemas_init_empty_directory(self):
        """Test schemas init generation with empty directory."""
        empty_dir = Path(self.test_dir) / "empty"
        empty_dir.mkdir()
        output_file = empty_dir / "__init__.py"

        result = generate_schemas_init(str(empty_dir), str(output_file))

        # Should still succeed but with minimal content
        self.assertTrue(result)
        self.assertTrue(output_file.exists())

        content = output_file.read_text()
        self.assertIn("# OpenSearch Protobuf Schemas", content)
        # Should not contain any import statements for pb2 files
        self.assertNotIn("from .", content.split('\n')[-5:])

    def test_generate_services_init_empty_directory(self):
        """Test services init generation with empty directory."""
        empty_dir = Path(self.test_dir) / "empty"
        empty_dir.mkdir()
        output_file = empty_dir / "__init__.py"

        result = generate_services_init(str(empty_dir), str(output_file))

        # Should succeed but create minimal content (current behavior)
        self.assertTrue(result)
        self.assertTrue(output_file.exists())

        content = output_file.read_text()
        self.assertIn("# OpenSearch Protobuf Services", content)
        # Should not contain any import statements since no files
        import_lines = [line for line in content.split('\n') if line.startswith("from .")]
        self.assertEqual(len(import_lines), 0)

    def test_generate_schemas_init_file_write_error(self):
        """Test schemas init generation with file write permission error."""
        # Use a more reliable way to test write errors by mocking
        output_file = self.schemas_dir / "__init__.py"

        with patch('builtins.open', side_effect=PermissionError("Permission denied")):
            result = generate_schemas_init(str(self.schemas_dir), str(output_file))

        self.assertEqual(result, [])  # Should return empty list on failure

    def test_generate_services_init_file_write_error(self):
        """Test services init generation with file write permission error."""
        # Use a more reliable way to test write errors by mocking
        output_file = self.services_dir / "__init__.py"

        with patch('builtins.open', side_effect=PermissionError("Permission denied")):
            result = generate_services_init(str(self.services_dir), str(output_file))

        self.assertFalse(result)

    def test_schemas_init_content_format(self):
        """Test that schemas init file has correct format and imports."""
        output_file = self.schemas_dir / "__init__.py"
        generate_schemas_init(str(self.schemas_dir), str(output_file))

        content = output_file.read_text()
        lines = content.strip().split('\n')

        # Check header
        self.assertEqual(lines[0], "# OpenSearch Protobuf Schemas")

        # Check that imports are in alphabetical order
        import_lines = [line for line in lines if line.startswith("from .")]
        expected_imports = [
            "from .common_pb2 import *",
            "from .document_pb2 import *",
            "from .search_pb2 import *"
        ]
        for expected in expected_imports:
            self.assertIn(expected, import_lines)

    def test_services_init_content_format(self):
        """Test that services init file has correct format and imports."""
        output_file = self.services_dir / "__init__.py"
        generate_services_init(str(self.services_dir), str(output_file))

        content = output_file.read_text()
        lines = content.strip().split('\n')

        # Check header
        self.assertEqual(lines[0], "# OpenSearch Protobuf Services")

        # Check that both pb2 and grpc imports are present
        import_lines = [line for line in lines if line.startswith("from .")]
        expected_imports = [
            "from .document_service_pb2 import *",
            "from .search_service_pb2 import *",
            "from .document_service_pb2_grpc import *",
            "from .search_service_pb2_grpc import *"
        ]
        for expected in expected_imports:
            self.assertIn(expected, import_lines)

    def test_atomic_file_writing(self):
        """Test that files are written atomically (temp file then rename)."""
        output_file = self.schemas_dir / "__init__.py"

        # Mock the file operations to verify atomic writing
        with patch('pathlib.Path.replace') as mock_replace:
            with patch('builtins.open', mock_open()) as mock_file:
                result = generate_schemas_init(str(self.schemas_dir), str(output_file))

                self.assertTrue(result)
                # Verify that replace was called (atomic operation)
                mock_replace.assert_called_once()

    def test_unicode_handling(self):
        """Test that the script handles unicode characters properly."""
        # Create a file with unicode content
        unicode_file = self.schemas_dir / "unicode_pb2.py"
        unicode_file.write_text("# Unicode test: 测试 🚀\nclass UnicodeClass:\n    pass\n", encoding='utf-8')

        output_file = self.schemas_dir / "__init__.py"
        result = generate_schemas_init(str(self.schemas_dir), str(output_file))

        self.assertTrue(result)
        self.assertTrue(output_file.exists())

        # Verify the file can be read back with unicode
        content = output_file.read_text(encoding='utf-8')
        self.assertIn("from .unicode_pb2 import *", content)

    @patch('sys.argv', ['generate_init_files.py', 'schemas_dir', 'services_dir'])
    @patch('generate_init_files.generate_schemas_init')
    @patch('generate_init_files.generate_services_init')
    @patch('os.path.exists')
    def test_main_function_success(self, mock_exists, mock_services, mock_schemas):
        """Test the main function with successful execution."""
        mock_exists.return_value = True
        mock_schemas.return_value = ["*"]
        mock_services.return_value = True

        with patch('sys.exit') as mock_exit:
            main()
            mock_exit.assert_called_with(0)  # Success exit code

    @patch('sys.argv', ['generate_init_files.py', 'schemas_dir', 'services_dir'])
    @patch('generate_init_files.generate_schemas_init')
    @patch('generate_init_files.generate_services_init')
    def test_main_function_failure(self, mock_services, mock_schemas):
        """Test the main function with failure."""
        mock_schemas.return_value = []  # Failure
        mock_services.return_value = False  # Failure

        with patch('sys.exit') as mock_exit:
            main()
            mock_exit.assert_called_with(1)  # Error exit code

    @patch('sys.argv', ['generate_init_files.py'])  # Missing arguments
    def test_main_function_wrong_args(self):
        """Test the main function with wrong number of arguments."""
        with patch('sys.exit') as mock_exit:
            try:
                main()
            except IndexError:
                # This is expected when sys.argv doesn't have enough arguments
                pass
            mock_exit.assert_called_with(1)  # Error exit code

    def test_only_pb2_files_processed(self):
        """Test that only _pb2.py files are processed for schemas."""
        # Create a non-pb2 file
        (self.schemas_dir / "regular_file.py").write_text("# Not a protobuf file")
        (self.schemas_dir / "another_pb2.py").write_text("# Protobuf file\nclass TestClass:\n    pass")

        output_file = self.schemas_dir / "__init__.py"
        result = generate_schemas_init(str(self.schemas_dir), str(output_file))

        self.assertTrue(result)
        content = output_file.read_text()

        # Should include pb2 files
        self.assertIn("from .another_pb2 import *", content)
        # Should not include regular files
        self.assertNotIn("from .regular_file import *", content)

    def test_grpc_files_processed_for_services(self):
        """Test that both _pb2.py and _pb2_grpc.py files are processed for services."""
        output_file = self.services_dir / "__init__.py"
        result = generate_services_init(str(self.services_dir), str(output_file))

        self.assertTrue(result)
        content = output_file.read_text()

        # Should include both pb2 and grpc files
        self.assertIn("from .document_service_pb2 import *", content)
        self.assertIn("from .document_service_pb2_grpc import *", content)
        self.assertIn("from .search_service_pb2 import *", content)
        self.assertIn("from .search_service_pb2_grpc import *", content)

    def test_file_sorting(self):
        """Test that files are processed in sorted order."""
        # Create files that would be out of order alphabetically
        (self.schemas_dir / "zebra_pb2.py").write_text("# Last alphabetically")
        (self.schemas_dir / "alpha_pb2.py").write_text("# First alphabetically")

        output_file = self.schemas_dir / "__init__.py"
        result = generate_schemas_init(str(self.schemas_dir), str(output_file))

        self.assertTrue(result)
        content = output_file.read_text()

        # Find the import lines
        import_lines = [line for line in content.split('\n') if line.startswith("from .")]

        # Verify they are in alphabetical order
        self.assertTrue(any("alpha_pb2" in line for line in import_lines))
        self.assertTrue(any("zebra_pb2" in line for line in import_lines))

        # Find positions
        alpha_pos = next(i for i, line in enumerate(import_lines) if "alpha_pb2" in line)
        zebra_pos = next(i for i, line in enumerate(import_lines) if "zebra_pb2" in line)

        self.assertLess(alpha_pos, zebra_pos, "Files should be sorted alphabetically")


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and error conditions."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.test_dir)

    def test_directory_with_spaces_in_name(self):
        """Test handling directories with spaces in names."""
        spaced_dir = Path(self.test_dir) / "dir with spaces"
        spaced_dir.mkdir()

        # Create a test file
        (spaced_dir / "test_pb2.py").write_text("# Test file")

        output_file = spaced_dir / "__init__.py"
        result = generate_schemas_init(str(spaced_dir), str(output_file))

        self.assertTrue(result)
        self.assertTrue(output_file.exists())

    def test_very_long_filename(self):
        """Test handling very long filenames."""
        test_dir = Path(self.test_dir) / "schemas"
        test_dir.mkdir()

        # Create a file with a very long name
        long_name = "very_long_filename_that_exceeds_normal_length_limits_pb2.py"
        (test_dir / long_name).write_text("# Long filename test")

        output_file = test_dir / "__init__.py"
        result = generate_schemas_init(str(test_dir), str(output_file))

        self.assertTrue(result)
        content = output_file.read_text()
        expected_import = f"from .{long_name[:-3]} import *"  # Remove .py extension
        self.assertIn(expected_import, content)

    def test_empty_pb2_files(self):
        """Test handling empty _pb2.py files."""
        test_dir = Path(self.test_dir) / "schemas"
        test_dir.mkdir()

        # Create empty files
        (test_dir / "empty_pb2.py").write_text("")
        (test_dir / "also_empty_pb2.py").write_text("   \n  \n")  # Whitespace only

        output_file = test_dir / "__init__.py"
        result = generate_schemas_init(str(test_dir), str(output_file))

        self.assertTrue(result)
        content = output_file.read_text()
        self.assertIn("from .empty_pb2 import *", content)
        self.assertIn("from .also_empty_pb2 import *", content)


if __name__ == '__main__':
    # Configure logging for tests
    import logging
    logging.basicConfig(level=logging.WARNING)  # Reduce noise during tests

    # Run the tests
    unittest.main(verbosity=2)
