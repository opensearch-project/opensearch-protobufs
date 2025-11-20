import { OpenAPIV3 } from 'openapi-types';
import { traverse } from './utils/OpenApiTraverser';
import { resolveRef } from './utils/helper';
import Logger from './utils/logger';

/**
 * VendorExtensionProcessor class:
 * Handles processing of vendor extensions in OpenAPI specifications.
 */
export class VendorExtensionProcessor {
    private static readonly PROTOBUF_EXCLUDED_EXTENSION = 'x-protobuf-excluded';
    private static readonly PROTOBUF_TYPE_EXTENSION = 'x-protobuf-type';

    private static readonly PROTOBUF_TYPE_MAPPING: Record<string, { type: string; format?: string }> = {
        'int32': { type: 'integer', format: 'int32' },
        'int64': { type: 'integer', format: 'int64' },
        'float': { type: 'number', format: 'float' },
        'double': { type: 'number', format: 'double' },
        'bool': { type: 'boolean' },
        'string': { type: 'string' },
    };

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

        this.removeProtobufExcludedFromPaths();
        traverse(this.root, {
            onSchema: (schema: any, name: string) => {
                this.removeProtobufExcludedProperties(schema);
                this.applyTypeOverride(schema);
            },
            onResponseSchema: (schema: any, name: string) => {
                this.removeProtobufExcludedProperties(schema);
                this.applyTypeOverride(schema);
            },
            onRequestSchema: (schema: any, name: string) => {
                this.removeProtobufExcludedProperties(schema);
                this.applyTypeOverride(schema);
            },
            onSchemaProperty: (schema: any, name: string) => {
                this.applyTypeOverride(schema);
            }
        });

        return this.root;
    }

    private hasProtobufExcluded(item: any): boolean {
        if (!item || typeof item !== 'object') return false;

        if (VendorExtensionProcessor.PROTOBUF_EXCLUDED_EXTENSION in item && !!item[VendorExtensionProcessor.PROTOBUF_EXCLUDED_EXTENSION]) {
            return true;
        }
        if ('$ref' in item && typeof item.$ref === 'string') {
            const resolved = resolveRef(item.$ref, this.root);
            if (resolved && VendorExtensionProcessor.PROTOBUF_EXCLUDED_EXTENSION in resolved && !!resolved[VendorExtensionProcessor.PROTOBUF_EXCLUDED_EXTENSION]) {
                return true;
            }
        }

        return false;
    }

    /**
     * Remove x-protobuf-excluded items from path-level elements directly
     */
    private removeProtobufExcludedFromPaths(): void {
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
                    operation.parameters = operation.parameters.filter((p: any) => !this.hasProtobufExcluded(p));
                    const removedCount = originalLength - operation.parameters.length;
                    if (removedCount > 0) {
                        this.logger.info(`Removed ${removedCount} parameter(s) from ${method.toUpperCase()} ${pathKey} (${VendorExtensionProcessor.PROTOBUF_EXCLUDED_EXTENSION})`);
                    }
                }

                // Remove responses with x-protobuf-excluded
                if (operation.responses) {
                    for (const status in operation.responses) {
                        if (this.hasProtobufExcluded(operation.responses[status])) {
                            delete operation.responses[status];
                            this.logger.info(`Removed response ${status} from ${method.toUpperCase()} ${pathKey} (${VendorExtensionProcessor.PROTOBUF_EXCLUDED_EXTENSION})`);
                        }
                    }
                }
            }
        }
    }

    private removeProtobufExcludedProperties(schema: OpenAPIV3.SchemaObject): void {
        if (!schema?.properties) return;

        for (const prop in schema.properties) {
            const propSchema = schema.properties[prop];
            if (propSchema && typeof propSchema === 'object') {
                if (this.hasProtobufExcluded(propSchema)) {
                    delete schema.properties[prop];
                    this.logger.info(`Removed schema property ${prop} (${VendorExtensionProcessor.PROTOBUF_EXCLUDED_EXTENSION})`);
                }
            }
        }
    }

    /**
     * Apply type override to a schema if it has x-protobuf-type
     */
    private applyTypeOverride(schema: any): void {
        if (!schema) return;

        if (VendorExtensionProcessor.PROTOBUF_TYPE_EXTENSION in schema) {
            const protoType = schema[VendorExtensionProcessor.PROTOBUF_TYPE_EXTENSION];

            // Clear structural properties that might conflict
            if ('$ref' in schema) {
                delete schema.$ref;
            }
            if ('properties' in schema) {
                delete schema.properties;
            }
            if ('additionalProperties' in schema) {
                delete schema.additionalProperties;
            }
            if ('oneOf' in schema) {
                delete schema.oneOf;
            }
            if ('anyOf' in schema) {
                delete schema.anyOf;
            }
            if ('allOf' in schema) {
                delete schema.allOf;
            }

            const typeMapping = VendorExtensionProcessor.PROTOBUF_TYPE_MAPPING[protoType];
            if (typeMapping) {
                schema.type = typeMapping.type;
                if (typeMapping.format) {
                    schema.format = typeMapping.format;
                }
            } else {
                schema.type = protoType;
            }

            delete schema[VendorExtensionProcessor.PROTOBUF_TYPE_EXTENSION];
            this.logger.info(`Applied ${VendorExtensionProcessor.PROTOBUF_TYPE_EXTENSION}: ${protoType} -> type: ${schema.type}${schema.format ? `, format: ${schema.format}` : ''}`);
        }
    }
}
