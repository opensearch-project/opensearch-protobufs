import sys
import grpc
from opensearch.protos.schemas import document_pb2
from opensearch.protos.schemas import search_pb2
from opensearch.protos.services import document_service_pb2_grpc
from opensearch.protos.services import search_service_pb2_grpc

def test_grpc_operations():
    channel = grpc.insecure_channel('localhost:9200')
    document_stub = document_service_pb2_grpc.DocumentServiceStub(channel)
    search_stub = search_service_pb2_grpc.SearchServiceStub(channel)    
    bulk_request = document_pb2.BulkRequest()
    
    test_docs = [
        {
            "id": "1",
            "source": '{"title": "Document 1", "content": "This is the first test document"}'
        },
        {
            "id": "2",
            "source": '{"title": "Document 2", "content": "This is the second test document"}'
        },
        {
            "id": "3",
            "source": '{"title": "Document 3", "content": "This is the third test document"}'
        }
    ]
    
    for doc in test_docs:
        operation = document_pb2.BulkOperation()
        operation.index.index = "test-index"
        operation.index.id = doc["id"]
        operation.index.source = doc["source"]
        bulk_request.operations.append(operation)
    
    try:
        print("Sending bulk index request...")
        bulk_response = document_stub.Bulk(bulk_request)
        
        if bulk_response.errors:
            print("Bulk indexing had errors:", bulk_response)
            return False
            
        print(f"Successfully indexed {len(test_docs)} documents")
        
        search_request = search_pb2.SearchRequest()
        search_request.index = "test-index"
        search_request.query = '{"match_all": {}}'
        
        print("\nSending search request...")
        search_response = search_stub.Search(search_request)
        
        hits = search_response.hits.hits
        total_hits = search_response.hits.total.value
        
        if total_hits != len(test_docs):
            print(f"Error: Expected {len(test_docs)} documents, but found {total_hits}")
            return False
            
        print(f"\nSearch Results:")
        print(f"Total hits: {total_hits}")
        for hit in hits:
            print(f"Document ID: {hit.id}, Score: {hit.score}")
            print(f"Source: {hit.source}")
        
        print("\n✅ All tests passed successfully!")
        return True
        
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
