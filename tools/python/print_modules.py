import sys

print('Testing opensearch-protobufs wheel installation...')
print('Python version:', sys.version)

# Test both old and new import styles
print('\n=== Testing old import style (file name dependent) ===')
from opensearch.protobufs.schemas import common_pb2
print('✓ Successfully imported common_pb2')

print('Common module attributes:', [attr for attr in dir(common_pb2) if not attr.startswith('_')][:10])

print('\n=== Testing new import style (no file name dependency) ===')
from opensearch.protobufs.schemas import (
    BulkRequest, BulkRequestBody,
    GlobalParams, Script, ObjectMap,
    SearchRequest, SearchResponse
)
print('✓ Successfully imported BulkRequest, BulkRequestBody, GlobalParams, Script, ObjectMap, SearchRequest, SearchResponse')

# Demonstrate usage
bulk_request = BulkRequest()
global_params = GlobalParams()
search_request = SearchRequest()
print('✓ Successfully created instances without knowing file names')

print('\n=== Services ===')
from opensearch.protobufs.services import document_service_pb2
print('✓ Successfully imported document_service_pb2')

from opensearch.protobufs.services import search_service_pb2
print('✓ Successfully imported search_service_pb2')

print('Document service attributes:', [attr for attr in dir(document_service_pb2) if not attr.startswith('_')][:5])
print('Search service attributes:', [attr for attr in dir(search_service_pb2) if not attr.startswith('_')][:5])

print('\n Import structure updated successfully.')
