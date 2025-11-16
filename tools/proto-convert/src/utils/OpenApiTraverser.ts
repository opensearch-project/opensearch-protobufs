import { OpenAPIV3 } from 'openapi-types';

export type SchemaVisitorSet = {
    onSchema?: (schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, name: string) => void;
    onResponseSchema?: (schema: OpenAPIV3.SchemaObject, name: string) => void;
    onRequestSchema?: (schema: OpenAPIV3.SchemaObject, name: string) => void;
    onParameter?: (param: OpenAPIV3.ParameterObject, name: string) => void;
    onSchemaProperty?: (schema: OpenAPIV3.SchemaObject, propertyName: string) => void;
};

/**
 * Traverse OpenAPI spec components and invoke visitors on each type.
 */
export function traverse(
    spec: OpenAPIV3.Document,
    visitors: SchemaVisitorSet
): void {
    const components = spec.components;
    if (!components) return;

    // schemas
    if (components.schemas) {
        for (const schemaName in components.schemas) {
            const schema = components.schemas[schemaName];
            visitors.onSchema?.(schema, schemaName);
            if (!('$ref' in schema)) {
                traverseSchema(schema, visitors);
            }
        }
    }

    // responses
    if (components.responses) {
        for (const responseName in components.responses) {
            const response = components.responses[responseName];
            if (!('$ref' in response) && response.content?.['application/json']?.schema) {
                const schema = response.content['application/json'].schema;
                if (!('$ref' in schema)) {
                    visitors.onResponseSchema?.(schema, responseName);
                    traverseSchema(schema, visitors);
                }
            }
        }
    }

    // requestBodies
    if (components.requestBodies) {
        for (const requestName in components.requestBodies) {
            const request = components.requestBodies[requestName];
            if (!('$ref' in request)) {
                for (const contentType in request.content || {}) {
                    const content = (request.content as any)?.[contentType];
                    if (content?.schema && !('$ref' in content.schema)) {
                        const schema = content.schema;
                        visitors.onRequestSchema?.(schema, requestName);
                        traverseSchema(schema as OpenAPIV3.SchemaObject, visitors);
                    }
                }
            }
        }
    }

    // parameters
    if (components.parameters) {
        for (const paramName in components.parameters) {
            const param = components.parameters[paramName];
            if (!('$ref' in param)) {
                visitors.onParameter?.(param, paramName);
                if (param.schema && !('$ref' in param.schema)) {
                    traverseSchema(param.schema, visitors);
                }
            }
        }
    }
}

/**
 * Recursively traverses a schema and applies onSchemaProperty to all properties found.
 */
export function traverseSchema(
    schema: OpenAPIV3.SchemaObject,
    visitors: SchemaVisitorSet
): void {
    if (!schema) return;

    // Visit direct properties
    if (schema.properties) {
        for (const propName in schema.properties) {
            const propSchema = schema.properties[propName];
            if (!('$ref' in propSchema)) {
                visitors.onSchemaProperty?.(propSchema, propName);
                traverseSchema(propSchema, visitors); // recurse into nested properties
            }
        }
    }

    // Visit items (for array types)
    if (schema.type === 'array' && schema.items && typeof schema.items === 'object' && !('$ref' in schema.items)) {
        traverseSchema(schema.items as OpenAPIV3.SchemaObject, visitors);
    }

    // Visit additionalProperties
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object' && !('$ref' in schema.additionalProperties)
    ) {
        traverseSchema(schema.additionalProperties as OpenAPIV3.SchemaObject, visitors);
    }

    // Visit composed schemas
    const composedKeys = ['allOf', 'anyOf', 'oneOf'] as const;
    for (const key of composedKeys) {
        const subschemas = schema[key];
        if (Array.isArray(subschemas)) {
            for (const sub of subschemas) {
                if (!('$ref' in sub)) {
                    visitors.onSchema?.(sub, `${key}`);
                    traverseSchema(sub, visitors);
                }
            }
        }
    }
}
