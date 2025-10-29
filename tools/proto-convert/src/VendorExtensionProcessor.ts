import { OpenAPIV3 } from 'openapi-types';
import { traverse } from './utils/OpenApiTraverser';
import Logger from './utils/logger';

/**
 * VendorExtensionProcessor class:
 * Handles processing of vendor extensions in OpenAPI specifications.
 */
export class VendorExtensionProcessor {
    private static readonly GRPC_REMOVED_EXTENSION = 'x-protobuf-excluded';

    private root: OpenAPIV3.Document;
    private logger: Logger;

    constructor(root: OpenAPIV3.Document, logger: Logger = new Logger()) {
        this.root = root;
        this.logger = logger;
    }

    /**
     * Process the spec by pruning anything marked with x-protobuf-excluded
     * Direct path-level handling + traverse for schemas only
     */
    public process(): OpenAPIV3.Document {
        this.logger.info(`Processing vendor extensions (${VendorExtensionProcessor.GRPC_REMOVED_EXTENSION})...`);

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
        if (!item || typeof item !== 'object') return false;

        if (VendorExtensionProcessor.GRPC_REMOVED_EXTENSION in item && !!item[VendorExtensionProcessor.GRPC_REMOVED_EXTENSION]) {
            return true;
        }
        if ('$ref' in item && typeof item.$ref === 'string') {
            const resolved = this.resolveRef(item.$ref);
            if (resolved && VendorExtensionProcessor.GRPC_REMOVED_EXTENSION in resolved && !!resolved[VendorExtensionProcessor.GRPC_REMOVED_EXTENSION]) {
                return true;
            }
        }

        return false;
    }

    /**
     * Resolve a $ref string to the actual object
     */
    private resolveRef(ref: string): any {
        if (!ref.startsWith('#/')) return null;

        const parts = ref.substring(2).split('/');
        let current: any = this.root;

        for (const part of parts) {
            if (!current || typeof current !== 'object') return null;
            current = current[part];
        }

        return current;
    }

    /**
     * Remove x-protobuf-excluded items from path-level elements directly
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

                // Remove parameters with x-protobuf-excluded
                if (Array.isArray(operation.parameters)) {
                    const originalLength = operation.parameters.length;
                    operation.parameters = operation.parameters.filter((p: any) => !this.hasGrpcRemoved(p));
                    const removedCount = originalLength - operation.parameters.length;
                    if (removedCount > 0) {
                        this.logger.info(`Removed ${removedCount} parameter(s) from ${method.toUpperCase()} ${pathKey} (${VendorExtensionProcessor.GRPC_REMOVED_EXTENSION})`);
                    }
                }

                // Remove responses with x-protobuf-excluded
                if (operation.responses) {
                    for (const status in operation.responses) {
                        if (this.hasGrpcRemoved(operation.responses[status])) {
                            delete operation.responses[status];
                            this.logger.info(`Removed response ${status} from ${method.toUpperCase()} ${pathKey} (${VendorExtensionProcessor.GRPC_REMOVED_EXTENSION})`);
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
                    this.logger.info(`Removed schema property ${prop} (${VendorExtensionProcessor.GRPC_REMOVED_EXTENSION})`);
                }
            }
        }
    }
}
