import type {OpenAPIV3} from "openapi-types";
import { traverse } from './utils/OpenApiTraverser';
export class TypeModifier {
    public modify(OpenApiSpec: OpenAPIV3.Document): any {
        traverse(OpenApiSpec, {
            // change additionalProperties: true or additionalProperties:object to object
            onSchemaProperty: (schema) => {
                if (schema.additionalProperties === true || (
                    typeof schema.additionalProperties === 'object' &&
                    this.isEmptyObjectSchema(schema.additionalProperties as OpenAPIV3.SchemaObject)
                )) {
                    schema.type = 'object';
                    delete schema.additionalProperties;
                }
            }
        });
        return OpenApiSpec;
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