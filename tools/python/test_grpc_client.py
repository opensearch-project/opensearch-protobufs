import sys
import grpc
from opensearch.protos.schemas import common_pb2
from opensearch.protos.schemas import document_pb2
from opensearch.protos.schemas import search_pb2
from opensearch.protos.services import document_service_pb2_grpc
from opensearch.protos.services import search_service_pb2_grpc

def test_grpc_operations():
    channel = grpc.insecure_channel('localhost:9400')
    document_stub = document_service_pb2_grpc.DocumentServiceStub(channel)
    search_stub = search_service_pb2_grpc.SearchServiceStub(channel)

    # Test data
    test_index = "test-index"
    test_docs = [
        '{"title": "Document 1", "content": "This is the first test document"}',
        '{"title": "Document 2", "content": "This is the second test document"}',
        '{"title": "Document 3", "content": "This is the third test document"}'  
    ]

    # Build bulk request
    bulk_request = document_pb2.BulkRequest()
    bulk_request.index = test_index
    for doc in test_docs:
        requestBody = document_pb2.BulkRequestBody()
        requestBody.doc = doc.encode('utf-8')
        index_op = document_pb2.IndexOperation()
        requestBody.index.CopyFrom(index_op)
        bulk_request.request_body.append(requestBody)
    
    # Build search request
    search_request = search_pb2.SearchRequest(
        request_body=search_pb2.SearchRequestBody(
            query=common_pb2.QueryContainer(match_all=common_pb2.MatchAllQuery())
        ),
        index=[test_index],
        source=common_pb2.SourceConfigParam(bool_value=False),
        timeout=None,
        request_cache=False,
        size=3
    )

    try:
        print("Sending bulk index request...")
        bulk_response = document_stub.Bulk(bulk_request)
        assert(bulk_response.bulk_response_body.errors == False)
        print("Sending search request...")
        search_response = search_stub.Search(search_request)
        assert(
            search_response.response_body.shards.successful == 
            search_response.response_body.shards.total
        )
    except grpc.RpcError as e:
        print(f"gRPC error occurred: {e.code()}: {e.details()}")
        return False
    except Exception as e:
        print(f"Unexpected error occurred: {str(e)}")
        return False
    finally:
        channel.close()

if __name__ == "__main__":
    success = test_grpc_operations()
    sys.exit(0 if success else 1)
