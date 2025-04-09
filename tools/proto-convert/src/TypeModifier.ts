import type {OpenAPIV3} from "openapi-types";
import { traverse } from './utils/OpenApiTraverser';
export class TypeModifier {
    public modify(OpenApiSpec: OpenAPIV3.Document): any {
        traverse(OpenApiSpec, {
            // change additionalProperties: true or additionalProperties:object to object
            onSchemaProperty: (schema) => {
                if (schema.additionalProperties === true || ( typeof schema.additionalProperties === 'object' &&  this.isEmptyObjectSchema(schema.additionalProperties as OpenAPIV3.SchemaObject))) {
                    schema.type = 'object';
                    delete schema.additionalProperties;
                }
            },
            onSchema: (schema, schemaName) => {
                if (!schema || this.isReferenceObject(schema)) return;
                // chang const to boolean under oneof.
                // title: schemaName + const
                if (schema.oneOf) {
                    for (const item of schema.oneOf) {
                        if (item && !('$ref' in item) && item.type === 'string' && 'const' in item) {
                            item.type = 'boolean';
                            item.title = `${schemaName}_${item.const}`;
                            delete item.const;
                        }
                    }
                }
            }
        });
        return OpenApiSpec;
    }

    isReferenceObject(schema: any): schema is OpenAPIV3.ReferenceObject {
        return schema !== null && typeof schema === 'object' && '$ref' in schema;
    }

    isEmptyObjectSchema(schema: OpenAPIV3.SchemaObject): boolean {
        return (
            schema.type === 'object' &&
            !schema.properties &&
            !schema.allOf &&
            !schema.anyOf &&
            !schema.oneOf &&
            !('$ref' in schema)
        );
    }
}