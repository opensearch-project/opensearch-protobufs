import { OpenAPIV3 } from 'openapi-types';
import { traverse } from './utils/OpenApiTraverser';
import { resolveRef, deleteMatchingKeys } from './utils/helper';
import Logger from './utils/logger';

/**
 * VendorExtensionProcessor class:
 * Handles processing of vendor extensions in OpenAPI specifications.
 */
export class VendorExtensionProcessor {
    private static readonly PROTOBUF_EXCLUDED_EXTENSION = 'x-protobuf-excluded';
    private static readonly PROTOBUF_TYPE_EXTENSION = 'x-protobuf-type';
    private static readonly PROTOBUF_NAME_EXTENSION = 'x-protobuf-name';

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
     * and applying vendor extensions (x-protobuf-name, x-protobuf-type)
     */
    public process(): OpenAPIV3.Document {
        deleteMatchingKeys(this.root, (item: any) => this.hasProtobufExcluded(item));

        traverse(this.root, {
            onParameter: (param: any, name: string) => {
                this.applyNameOverrideToParameter(param);
            },
            onSchema: (schema: any, name: string) => {
                this.applyTypeOverride(schema);
                this.applyNameOverride(schema);
            },
            onResponseSchema: (schema: any, name: string) => {
                this.applyTypeOverride(schema);
                this.applyNameOverride(schema);
            },
            onRequestSchema: (schema: any, name: string) => {
                this.applyTypeOverride(schema);
                this.applyNameOverride(schema);
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
     * Apply name override to a parameter if it has x-protobuf-name
     */
    private applyNameOverrideToParameter(param: OpenAPIV3.ParameterObject): void {
        if (!param || typeof param !== 'object' || !(VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION in param)) return;

        const newName = param[VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION];
        if (typeof newName === 'string' && param.name && newName !== param.name) {
            const oldName = param.name;
            param.name = newName;
            delete param[VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION];
            this.logger.info(`Renamed parameter '${oldName}' -> '${newName}' (${VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION})`);
        }
    }


    /**
     * Apply name override to schema properties and composed schemas (oneOf, anyOf, allOf)
     * - For properties: renames property keys
     * - For composed schemas: sets title field for sub-schemas
     */
    private applyNameOverride(schema: any): void {
        if (!schema || typeof schema !== 'object') return;

        // Rename properties within schema.properties collection
        if (schema?.properties) {
            for (const prop in schema.properties) {
                const propSchema = schema.properties[prop];
                if (propSchema && typeof propSchema === 'object' && VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION in propSchema) {
                    const newName = propSchema[VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION];
                    if (typeof newName === 'string' && newName !== prop) {
                        schema.properties[newName] = schema.properties[prop];
                        delete schema.properties[prop];
                        delete schema.properties[newName][VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION];

                        this.logger.info(`Renamed property '${prop}' -> '${newName}' (${VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION})`);
                    }
                }
            }
        }

        // Set title for composed schemas (oneOf, anyOf, allOf)
        const composedKeys = ['allOf', 'anyOf', 'oneOf'] as const;
        for (const key of composedKeys) {
            const subschemas = schema[key];
            if (!Array.isArray(subschemas)) continue;

            for (const subschema of subschemas) {
                if (subschema && typeof subschema === 'object' && VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION in subschema) {
                    const titleValue = subschema[VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION];
                    if (typeof titleValue === 'string') {
                        const oldTitle = subschema.title;
                        subschema.title = titleValue;
                        delete subschema[VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION];
                        this.logger.info(`Set title for ${key} sub-schema: '${oldTitle}' -> '${titleValue}' (${VendorExtensionProcessor.PROTOBUF_NAME_EXTENSION})`);
                    }
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
