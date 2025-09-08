import { OpenAPIV3 } from 'openapi-types';
import { traverse } from './utils/OpenApiTraverser';
import Logger from './utils/logger';

/**
 * VendorExtensionProcessor class:
 * Handles processing of vendor extensions in OpenAPI specifications.
 */
export class VendorExtensionProcessor {
    private root: OpenAPIV3.Document;
    private logger: Logger;

    constructor(root: OpenAPIV3.Document, logger: Logger = new Logger()) {
        this.root = root;
        this.logger = logger;
    }

    /**
     * Process the spec by pruning anything marked with x-grpc-removed
     * Direct path-level handling + traverse for schemas only
     */
    public process(): OpenAPIV3.Document {
        this.logger.info('Processing vendor extensions (x-grpc-removed)...');
        
        this.removeGrpcRemovedFromPaths();
        traverse(this.root, {
            onSchema: (schema: any, name: string) => {
                if ('$ref' in schema) return;
                this.removeGrpcRemovedProperties(schema);
            },
            onResponseSchema: (schema: any, name: string) => {
                this.removeGrpcRemovedProperties(schema);
            },
            onRequestSchema: (schema: any, name: string) => {
                this.removeGrpcRemovedProperties(schema);
            }
        });
        
        return this.root;
    }

    private hasGrpcRemoved(item: any): boolean {
        return item && typeof item === 'object' && 'x-grpc-removed' in item && item['x-grpc-removed'] === true;
    }

    /**
     * Remove x-grpc-removed items from path-level elements directly
     */
    private removeGrpcRemovedFromPaths(): void {
        if (!this.root.paths) return;
        
        for (const pathKey in this.root.paths) {
            const pathItem = this.root.paths[pathKey];
            if (!pathItem || typeof pathItem !== 'object' || '$ref' in pathItem) continue;
            
            // Handle operations
            for (const method in pathItem) {
                if (method === 'parameters' || method === '$ref' || method === 'summary' || 
                    method === 'description' || method === 'servers') continue;
                    
                const operation = (pathItem as any)[method];
                if (!operation || typeof operation !== 'object') continue;
                
                // Remove parameters with x-grpc-removed
                if (Array.isArray(operation.parameters)) {
                    const originalLength = operation.parameters.length;
                    operation.parameters = operation.parameters.filter((p: any) => !this.hasGrpcRemoved(p));
                    const removedCount = originalLength - operation.parameters.length;
                    if (removedCount > 0) {
                        this.logger.info(`Removed ${removedCount} parameter(s) from ${method.toUpperCase()} ${pathKey} (x-grpc-removed)`);
                    }
                }
                
                // Remove responses with x-grpc-removed
                if (operation.responses) {
                    for (const status in operation.responses) {
                        if (this.hasGrpcRemoved(operation.responses[status])) {
                            delete operation.responses[status];
                            this.logger.info(`Removed response ${status} from ${method.toUpperCase()} ${pathKey} (x-grpc-removed)`);
                        }
                    }
                }
            }
        }
    }

    private removeGrpcRemovedProperties(schema: OpenAPIV3.SchemaObject): void {
        if (!schema?.properties) return;
        
        for (const prop in schema.properties) {
            const propSchema = schema.properties[prop];
            if (propSchema && typeof propSchema === 'object' && !('$ref' in propSchema)) {
                if (this.hasGrpcRemoved(propSchema)) {
                    delete schema.properties[prop];
                    this.logger.info(`Removed schema property ${prop} (x-grpc-removed)`);
                }
            }
        }
    }
}
