import sys

print('Testing opensearch-protos wheel installation...')
print('Python version:', sys.version)

from opensearch.protos.schemas import common_pb2
print('✓ Successfully imported common_pb2')

from opensearch.protos.schemas import document_pb2
print('✓ Successfully imported document_pb2')

from opensearch.protos.schemas import search_pb2
print('✓ Successfully imported search_pb2')

print('Common module attributes:', [attr for attr in dir(common_pb2) if not attr.startswith('_')][:5])
print('Document module attributes:', [attr for attr in dir(document_pb2) if not attr.startswith('_')][:5])
print('Search module attributes:', [attr for attr in dir(search_pb2) if not attr.startswith('_')][:5])

from opensearch.protos.services import document_service_pb2
print('✓ Successfully imported document_service_pb2')

from opensearch.protos.services import search_service_pb2
print('✓ Successfully imported search_service_pb2')

print('Document service attributes:', [attr for attr in dir(document_service_pb2) if not attr.startswith('_')][:5])
print('Search service attributes:', [attr for attr in dir(search_service_pb2) if not attr.startswith('_')][:5])
