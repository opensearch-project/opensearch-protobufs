import type {OpenAPIV3} from "openapi-types";
import {traverse} from './utils/OpenApiTraverser';
import isEqual from 'lodash.isequal';
import {compressMultipleUnderscores, isPrimitiveType, resolveObj, isReferenceObject, isEmptyObjectSchema} from './utils/helper';
import Logger from "./utils/logger";


const DEFAULT_MAP_KEY = 'field' // default key for simplified additionalProperties
const DEFAULT_MAP_VALUE = 'value' // default value for simplified additionalProperties

export class SchemaModifier {
    logger: Logger
    root: OpenAPIV3.Document;
    constructor(root: OpenAPIV3.Document, logger: Logger = new Logger()) {
        this.root = root;
        this.logger = logger;
    }
    public modify(): OpenAPIV3.Document {
        traverse(this.root, {
            onSchemaProperty: (schema) => {
                this.deduplicateEnumValue(schema)
                this.handleAdditionalPropertiesUndefined(schema)
                this.convertNullTypeToNullValue(schema)
                this.collapseOrMergeOneOfArray(schema)
            },
            onSchema: (schema, schemaName) => {
                if (!schema || isReferenceObject(schema)) return;
                this.deduplicateEnumValue(schema)
                this.handleAdditionalPropertiesUndefined(schema)
                this.convertNullTypeToNullValue(schema)
                this.handleOneOfConst(schema, schemaName)
                this.collapseOrMergeOneOfArray(schema)
                this.collapseOneOfObjectPropContainsTitleSchema(schema)
            },
        });
        const visit = new Set();
        traverse(this.root, {
            onSchemaProperty: (schema) => {
                this.simplifySingleMapSchema(schema, visit)
            },
            onSchema: (schema) => {
                if (!schema || isReferenceObject(schema)) return;
                this.simplifySingleMapSchema(schema, visit)
            },
        });
        return this.root
    }

    // Converts `additionalProperties: true` or `additionalProperties: {}` to `type: object`.
    // Example: { additionalProperties: true } -> { type: 'object' }
    handleAdditionalPropertiesUndefined(schema: OpenAPIV3.SchemaObject): void {
        if (schema.additionalProperties === true || ( typeof schema.additionalProperties === 'object' && isEmptyObjectSchema(schema.additionalProperties as OpenAPIV3.SchemaObject))) {
            schema.type = 'object';
            delete schema.additionalProperties;
        }
    }

    // Converts `oneOf` schemas with `const` values to enum types.
    // Example: oneof: [ {type: 'string', const: 'a'}, {type: 'string', const: 'b'} ] to enum: ['a', 'b']
    // For non-string types, uses the type as enum value
    handleOneOfConst(schema: OpenAPIV3.SchemaObject, schemaName: string): void {
        if (schema.oneOf) {
            const enumValues: string[] = [];
            let hasStringWithConst = false;
            
            // check if have string with const
            for (const item of schema.oneOf) {
                if (item && !('$ref' in item) && item.type === 'string' && 'const' in item) {
                    hasStringWithConst = true;
                    break;
                }
            }
            
            // if found string+const, collect all values
            if (hasStringWithConst) {
                for (const item of schema.oneOf) {
                    if (item && !('$ref' in item)) {
                        if (item.type === 'string' && 'const' in item) {
                            // use const value as enum value
                            enumValues.push(item.const as string);
                        } else if (item.type) {
                            // use type name as enum value
                            enumValues.push(item.type);
                        }
                    }
                }
                
                // Convert to enum
                delete schema.oneOf;
                schema.type = 'string';
                schema.enum = enumValues;
            }
        }
    }

    // Simplify schemas with `oneOf` by aggregating items.
    // If there are only two `oneOf` items and one matches an array schema, remove oneOf type and set type to array.
    // If there are more than two `oneOf` items and one matches an array schema, remove that item from `oneOf`.
    collapseOrMergeOneOfArray(schema: OpenAPIV3.SchemaObject): void{
        if (!('$ref' in schema) && Array.isArray(schema.oneOf)) {
            const oneOfs = schema.oneOf;

            const arraySet = new Set<string>();
            var deleteIndx = -1;

            for (const oneOf of oneOfs) {
                if (this.isArraySchemaObject(oneOf)) {
                    const { type, $ref, additionalProperties} = oneOf.items as any;
                    const oneOfStr = JSON.stringify({ type, $ref, additionalProperties});
                    arraySet.add(oneOfStr)
                }
            }
            for (const oneOf of oneOfs) {
                const { type, $ref, additionalProperties} = oneOf as any;
                const oneOfStr = JSON.stringify({ type, $ref, additionalProperties});
                if (arraySet.has(oneOfStr)) {
                    deleteIndx = oneOfs.findIndex(item => isEqual(item, oneOf));
                    oneOfs.splice(deleteIndx, 1);
                }
            }
            this.collapseSingleItemOneOf(schema);
        }
    }

    collapseSingleItemOneOf(schema: OpenAPIV3.SchemaObject): void {
        if (Array.isArray(schema.oneOf) && schema.oneOf.length === 1) {
            const [singleOneOf] = schema.oneOf as OpenAPIV3.SchemaObject[];
            Object.assign(schema, singleOneOf);
            delete schema.oneOf;
        }
    }

    isArraySchemaObject(schema: any): schema is OpenAPIV3.ArraySchemaObject {
        return (
            typeof schema === 'object' &&
            schema !== null &&
            schema.type === 'array' &&
            'items' in schema
        );
    }

    /**
     * Collapses a `oneOf` schema if one of the objects contains a title schema that matches
     * a property in the other object.
     *
     * Example:
     *  Input:
     *  {
     *    oneOf: [
     *      { title: "exampleTitle", type: "string" },
     *      { type: "object", properties: { exampleTitle: { type: "string" } } }
     *    ]
     *  }
     *
     *  Output:
     *  {
     *    type: "object",
     *    properties: { exampleTitle: { type: "string" } }
     *  }
     **/
    collapseOneOfObjectPropContainsTitleSchema(schema: OpenAPIV3.SchemaObject): void {
        // TODO: might need to handle oneOf more than 2
        if (!Array.isArray(schema.oneOf) || schema.oneOf.length !== 2) {
            return;
        }
        const[first, second] = schema.oneOf;
        if (this.tryCollapseIfMatching(schema, first, second, 0)) return;
        if (this.tryCollapseIfMatching(schema, second, first, 1)) return;
    }
    /**
     * Attempts to collapse a `oneOf` schema by checking if a simple schema (with a title)
     * matches a property in a complex schema. If a match is found, the parent schema
     * is reconstructed by assigning the complex schema to it.
     *
     * */
    private tryCollapseIfMatching(schema: OpenAPIV3.SchemaObject, maybeSimple: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
                                  maybeComplex: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, indexOfSimple: number): boolean {
        let foundMath = false;
        if (! ('title' in maybeSimple && typeof (maybeSimple.title) === 'string')) {
            return false;
        }
        let titleContent = JSON.stringify(maybeSimple);
        let nameStr = maybeSimple.title;

        const complexObject = resolveObj(maybeComplex, this.root);
        if (!complexObject) {
            return false;
        }
        if (Array.isArray(complexObject.allOf)) {
            for (const allOf of complexObject.allOf) {
                const allOfObject = resolveObj(allOf, this.root);
                if (allOfObject && allOfObject.properties && allOfObject.properties[nameStr]) {
                    const propSchema =  allOfObject.properties[nameStr];
                    if (('$ref' in propSchema && titleContent.includes(propSchema.$ref)) ||
                        ('type' in propSchema && propSchema.type && titleContent.includes(propSchema.type))) {
                        foundMath = true;
                    }
                }
            }
        } else if (complexObject.type === 'object' && complexObject.properties) {
            if(complexObject.properties[nameStr] && '$ref' in complexObject.properties[nameStr]) {
                const propSchema =  complexObject.properties[nameStr];
                if (('$ref' in propSchema && titleContent.includes(propSchema.$ref)) ||
                    ('type' in propSchema && typeof propSchema.type ==="string" && titleContent.includes(propSchema.type))) {
                    foundMath = true;
                }
            }
        }
        // if complexSchema contains simpleSchema, reconstruct parent schema by assign complexSchema to parent schema.
        if (foundMath) {
            schema.oneOf?.splice(indexOfSimple, 1);
            const [remaining] = schema.oneOf || [];
            delete schema.oneOf;
            Object.assign(schema, remaining);
            return true;
        }
        return false;
    }

    createAdditionalPropertySchema(): OpenAPIV3.SchemaObject {
        return {
            type: "object",
            properties: {
                [DEFAULT_MAP_KEY]: {
                    type: "string"
                }
            }
        };
    }

    /**
     * Reconstructs the additional property schema putting map key into map values.
     **/
    reconstructAdditionalPropertySchema(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, visit: Set<any>): OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject {
        const complexObject = resolveObj(schema, this.root);

        if (!complexObject || visit.has(complexObject)) {
            return schema;
        }
        if (Array.isArray(complexObject?.allOf)) {
            complexObject?.allOf.push(this.createAdditionalPropertySchema());
        } else if (Array.isArray(complexObject.oneOf)) {
            for (const sub in complexObject.oneOf) {
                this.reconstructAdditionalPropertySchema(complexObject.oneOf[sub], visit);
            }
        } else if (Array.isArray(complexObject.anyOf)) {
            for (const sub in complexObject.anyOf) {
                this.reconstructAdditionalPropertySchema(complexObject.anyOf[sub], visit);
            }
        } else if (complexObject.type === 'object' && complexObject.properties) {
            if (complexObject.properties[DEFAULT_MAP_KEY]) {
                this.logger.error("Error: additionalProperties key already exists in the schema "+complexObject);
            }
            complexObject.properties[DEFAULT_MAP_KEY] = this.createAdditionalPropertySchema().properties?.[DEFAULT_MAP_KEY] as OpenAPIV3.SchemaObject || {};
        } else if (isPrimitiveType(complexObject)) {
            const defaultValueName = complexObject.title ?? DEFAULT_MAP_VALUE;
            const constructSchema = this.createAdditionalPropertySchema();
            constructSchema.properties = constructSchema.properties || {};
            constructSchema.properties[defaultValueName] = schema;
            return constructSchema;
        }
        visit.add(complexObject)
        return schema
    }

    /**
     * Transforms SchemaObject that single-key maps (`minProperties = 1` and `maxProperties = 1`) into standard schema by reconstructing
     * the additional property definitions.
     * Example:
     *  Input:
     * {
     *   type: "object",
     *   additionalProperties: {
     *     - ref: "#/components/schemas/Model"
     *   },
     *   minProperties: 1,
     *   maxProperties: 1,
     * };
     * Model:
     *  properties: {
     *      properties1: string
     *      properties2: string
     *  }
     *
     *
     *Output:
     *  {
     *    ref: "#/components/schemas/Example
     *  }
     *
     *  Model:
     *  properties: {
     *      field: string
     *      properties1: string
     *      properties2: string
     *  }
     *
     **/
    simplifySingleMapSchema(schema: OpenAPIV3.SchemaObject, visit: Set<any>): void {
        if (schema.type === 'object' && typeof schema.additionalProperties === 'object' &&
            !Array.isArray(schema.additionalProperties) && schema.minProperties === 1 && schema.maxProperties === 1){

            const reconstructAdditionalPropertySchema = this.reconstructAdditionalPropertySchema(schema.additionalProperties, visit);

            Object.assign(schema, reconstructAdditionalPropertySchema)

            delete schema.additionalProperties;
            delete schema.minProperties;
            delete schema.maxProperties;
            delete schema.type
            if ('propertyNames' in schema) {
                delete schema.propertyNames;
            }
        }
    }

    /**
     * Removes duplicate enum values
     * Example:
     *   input:
     *    Operator: { type: string, enum: [AND, and, or, OR] }
     *   output:
     *    Operator: { type: string enum: [and, or] }
     *
     **/
    deduplicateEnumValue(schema: { enum?: string[] }): void {
        if (!schema.enum || !Array.isArray(schema.enum)) {
            return;
        }
        const enumSet = new Set<string>();
        for (const value of schema.enum) {
            const enumValue = value.toLowerCase();
            enumSet.add(enumValue)
        }

        schema.enum = Array.from(enumSet)
    }

    // Converts type: "null" to type: NullValue for protobuf compatibility
    convertNullTypeToNullValue(schema: OpenAPIV3.SchemaObject): void {
        if ((schema.type as any) === 'null') {
            (schema as any).type = 'NullValue';
        }
    }
}
