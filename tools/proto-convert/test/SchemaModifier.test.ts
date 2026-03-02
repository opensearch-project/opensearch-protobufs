/**
 * Tests for SchemaModifier.
 */

import type { OpenAPIV3 } from 'openapi-types';
import { SchemaModifier } from '../src/SchemaModifier';

describe('SchemaModifier', () => {
    // Helper to create a minimal OpenAPI document
    const createDocument = (): OpenAPIV3.Document => ({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
    });

    describe('modify - full pipeline', () => {
        it('should apply all transformations through modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestSchema = {
                type: 'object',
                properties: {
                    field1: { type: 'string' },
                    field2: { type: 'number' }
                }
            };

            const modifier = new SchemaModifier(doc);
            const result = modifier.modify();

            expect(result).toBe(doc);
            expect(result.components!.schemas!.TestSchema).toBeDefined();
        });

        it('should handle single map schemas in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.SortOrder = {
                type: 'string',
                enum: ['asc', 'desc']
            };
            doc.components!.schemas!.TestMap = {
                type: 'object',
                additionalProperties: {
                    $ref: '#/components/schemas/SortOrder'
                },
                minProperties: 1,
                maxProperties: 1
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            // Should create SingleMap schema
            expect(doc.components!.schemas!.SortOrderSingleMap).toBeDefined();
        });

        it('should handle QueryContainer properties in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.BoolQuery = {
                type: 'object',
                properties: {
                    must: { 
                        type: 'array',
                        items: { type: 'string' }
                    }
                }
            };
            doc.components!.schemas!.QueryContainer = {
                type: 'object',
                properties: {
                    bool: {
                        type: 'object',
                        additionalProperties: {
                            $ref: '#/components/schemas/BoolQuery'
                        },
                        minProperties: 1,
                        maxProperties: 1
                    }
                }
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            // QueryContainer properties should use inline behavior
            const boolProp = (doc.components!.schemas!.QueryContainer as any).properties.bool;
            expect(boolProp.$ref).toBe('#/components/schemas/BoolQuery');
        });

        it('should deduplicate enum values in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestEnum = {
                type: 'string',
                enum: ['a', 'b', 'a', 'c', 'b']
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            const schema = doc.components!.schemas!.TestEnum as any;
            expect(schema.enum).toEqual(['a', 'b', 'c']);
        });

        it('should handle additionalProperties: true in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestSchema = {
                type: 'object',
                properties: {
                    nested: {
                        additionalProperties: true
                    } as any
                }
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            const nestedProp = (doc.components!.schemas!.TestSchema as any).properties.nested;
            expect(nestedProp.type).toBe('object');
            expect(nestedProp.additionalProperties).toBeUndefined();
        });

        it('should collapse single item composites in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestSchema = {
                type: 'object',
                properties: {
                    field: {
                        allOf: [
                            { type: 'string' }
                        ]
                    }
                }
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            const fieldProp = (doc.components!.schemas!.TestSchema as any).properties.field;
            expect(fieldProp.allOf).toBeUndefined();
            expect(fieldProp.type).toBe('string');
        });

        it('should handle null type conversion in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestSchema = {
                type: 'object',
                properties: {
                    field: {
                        type: 'null' as any
                    }
                }
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            const fieldProp = (doc.components!.schemas!.TestSchema as any).properties.field;
            expect(fieldProp.type).toBe('NullValue');
        });

        it('should deduplicate oneOf with array type in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestSchema = {
                type: 'object',
                properties: {
                    field: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ]
                    }
                }
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            const fieldProp = (doc.components!.schemas!.TestSchema as any).properties.field;
            // After deduplication and collapseSingleItemComposite, the oneOf should be collapsed
            // to just the array type
            expect(fieldProp.type).toBe('array');
            expect(fieldProp.items).toEqual({ type: 'string' });
        });

        it('should convert additionalProperties to named property in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestSchema = {
                type: 'object',
                additionalProperties: {
                    title: 'metadata',
                    type: 'object'
                },
                minProperties: 2
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            const schema = doc.components!.schemas!.TestSchema as any;
            expect(schema.properties).toHaveProperty('metadata');
            expect(schema.additionalProperties).toBeUndefined();
        });

        it('should handle oneOf with const values in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestEnum = {
                oneOf: [
                    { type: 'string', const: 'option1' } as any,
                    { type: 'string', const: 'option2' } as any,
                    { type: 'string', const: 'option3' } as any
                ]
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            const schema = doc.components!.schemas!.TestEnum as any;
            expect(schema.oneOf).toBeUndefined();
            expect(schema.type).toBe('string');
            expect(schema.enum).toEqual(['option1', 'option2', 'option3']);
        });

        it('should mark oneOf extensions in modify()', () => {
            const doc = createDocument();
            doc.components!.schemas!.OptionA = {
                type: 'object',
                properties: { a: { type: 'string' } }
            };
            doc.components!.schemas!.OptionB = {
                type: 'object',
                properties: { b: { type: 'number' } }
            };
            doc.components!.schemas!.TestUnion = {
                type: 'object',
                maxProperties: 1,
                properties: {
                    variant: {
                        oneOf: [
                            { title: 'optionA', $ref: '#/components/schemas/OptionA' },
                            { title: 'optionB', $ref: '#/components/schemas/OptionB' }
                        ]
                    }
                }
            };

            const modifier = new SchemaModifier(doc);
            modifier.modify();

            const schema = doc.components!.schemas!.TestUnion as any;
            expect(schema['x-oneof-schema']).toBe(true);
            expect(schema.properties.variant['x-oneof-property']).toBe(true);
        });

        it('should skip $ref objects in onSchema callbacks', () => {
            const doc = createDocument();
            doc.components!.schemas!.RefSchema = {
                $ref: '#/components/schemas/OtherSchema'
            };
            doc.components!.schemas!.OtherSchema = {
                type: 'string'
            };

            const modifier = new SchemaModifier(doc);
            
            // Should not throw error on $ref
            expect(() => modifier.modify()).not.toThrow();
        });
    });

    describe('deduplicateOneOfWithArrayType', () => {
        it('should remove single item when array of same primitive type exists', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [
                    { type: 'string' },
                    { type: 'array', items: { type: 'string' } }
                ]
            };

            modifier.deduplicateOneOfWithArrayType(schema);

            expect(schema.oneOf).toHaveLength(1);
            expect(schema.oneOf![0]).toEqual({ type: 'array', items: { type: 'string' } });
        });

        it('should remove single item when array of same $ref type exists', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [
                    { $ref: '#/components/schemas/MyType' },
                    { type: 'array', items: { $ref: '#/components/schemas/MyType' } }
                ]
            };

            modifier.deduplicateOneOfWithArrayType(schema);

            expect(schema.oneOf).toHaveLength(1);
            expect(schema.oneOf![0]).toEqual({
                type: 'array',
                items: { $ref: '#/components/schemas/MyType' }
            });
        });

        it('should not modify when no duplicate exists', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [
                    { type: 'string' },
                    { type: 'array', items: { type: 'integer' } }
                ]
            };

            modifier.deduplicateOneOfWithArrayType(schema);

            expect(schema.oneOf).toHaveLength(2);
            expect(schema.oneOf![0]).toEqual({ type: 'string' });
            expect(schema.oneOf![1]).toEqual({ type: 'array', items: { type: 'integer' } });
        });

        it('should handle additionalProperties in type comparison', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [
                    { type: 'object', additionalProperties: { type: 'string' } },
                    { type: 'array', items: { type: 'object', additionalProperties: { type: 'string' } } }
                ]
            };

            modifier.deduplicateOneOfWithArrayType(schema);

            expect(schema.oneOf).toHaveLength(1);
            expect(schema.oneOf![0]).toEqual({
                type: 'array',
                items: { type: 'object', additionalProperties: { type: 'string' } }
            });
        });

        it('should not remove when additionalProperties differ', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [
                    { type: 'object', additionalProperties: { type: 'string' } },
                    { type: 'array', items: { type: 'object', additionalProperties: { type: 'integer' } } }
                ]
            };

            modifier.deduplicateOneOfWithArrayType(schema);

            expect(schema.oneOf).toHaveLength(2);
        });

        it('should not modify schema without oneOf', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                }
            };

            modifier.deduplicateOneOfWithArrayType(schema);

            expect(schema.oneOf).toBeUndefined();
            expect(schema.type).toBe('object');
        });

        it('should remove first matching single item when multiple array types exist', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [
                    { type: 'string' },
                    { type: 'integer' },
                    { type: 'array', items: { type: 'string' } },
                    { type: 'array', items: { type: 'integer' } }
                ]
            };

            modifier.deduplicateOneOfWithArrayType(schema);

            expect(schema.oneOf).toHaveLength(3);
            expect(schema.oneOf).toContainEqual({ type: 'integer' });
            expect(schema.oneOf).toContainEqual({ type: 'array', items: { type: 'string' } });
            expect(schema.oneOf).toContainEqual({ type: 'array', items: { type: 'integer' } });
        });

        it('should preserve items not matching any array type', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [
                    { type: 'string' },
                    { type: 'boolean' },
                    { type: 'array', items: { type: 'string' } }
                ]
            };

            modifier.deduplicateOneOfWithArrayType(schema);

            expect(schema.oneOf).toHaveLength(2);
            expect(schema.oneOf).toContainEqual({ type: 'boolean' });
            expect(schema.oneOf).toContainEqual({ type: 'array', items: { type: 'string' } });
        });
    });

    describe('collapseSingleItemComposite', () => {
        it('should collapse single-item oneOf', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [{ type: 'string' }]
            };

            modifier.collapseSingleItemComposite(schema);

            expect(schema.oneOf).toBeUndefined();
            expect(schema.type).toBe('string');
        });

        it('should collapse single-item allOf', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                allOf: [{ type: 'integer' }]
            };

            modifier.collapseSingleItemComposite(schema);

            expect(schema.allOf).toBeUndefined();
            expect(schema.type).toBe('integer');
        });

        it('should collapse single-item anyOf', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                anyOf: [{ $ref: '#/components/schemas/MyType' }]
            };

            modifier.collapseSingleItemComposite(schema);

            expect(schema.anyOf).toBeUndefined();
            expect((schema as any).$ref).toBe('#/components/schemas/MyType');
        });

        it('should not collapse multi-item oneOf', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [
                    { type: 'string' },
                    { type: 'integer' }
                ]
            };

            modifier.collapseSingleItemComposite(schema);

            expect(schema.oneOf).toHaveLength(2);
        });

        it('should not modify empty array', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                oneOf: []
            };

            modifier.collapseSingleItemComposite(schema);

            expect(schema.oneOf).toHaveLength(0);
        });
    });

    describe('handleAdditionalPropertiesUndefined', () => {
        it('should convert additionalProperties: true to type: object', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                additionalProperties: true
            };

            modifier.handleAdditionalPropertiesUndefined(schema);

            expect(schema.type).toBe('object');
            expect(schema.additionalProperties).toBeUndefined();
        });

        it('should convert empty additionalProperties to type: object', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                additionalProperties: { type: 'object' }
            };

            modifier.handleAdditionalPropertiesUndefined(schema);

            expect(schema.type).toBe('object');
            expect(schema.additionalProperties).toBeUndefined();
        });

        it('should not modify when additionalProperties has a schema', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                additionalProperties: { type: 'string' }
            };

            modifier.handleAdditionalPropertiesUndefined(schema);

            expect(schema.additionalProperties).toEqual({ type: 'string' });
        });
    });

    describe('handleOneOfConst', () => {
        it('should convert oneOf with const values to enum', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    { type: 'string', const: 'value1' },
                    { type: 'string', const: 'value2' }
                ]
            };

            modifier.handleOneOfConst(schema, 'TestSchema');

            expect(schema.oneOf).toBeUndefined();
            expect(schema.type).toBe('string');
            expect(schema.enum).toEqual(['value1', 'value2']);
        });

        it('should use type as enum value for non-const items', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    { type: 'string', const: 'text' },
                    { type: 'number' }
                ]
            };

            modifier.handleOneOfConst(schema, 'TestSchema');

            expect(schema.enum).toEqual(['text', 'number']);
        });

        it('should not convert when no const values exist', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    { type: 'string' },
                    { type: 'number' }
                ]
            };

            modifier.handleOneOfConst(schema, 'TestSchema');

            expect(schema.oneOf).toBeDefined();
            expect(schema.enum).toBeUndefined();
        });
    });

    describe('convertNullTypeToNullValue', () => {
        it('should convert type: null to type: NullValue', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'null'
            };

            modifier.convertNullTypeToNullValue(schema);

            expect(schema.type).toBe('NullValue');
        });

        it('should not modify other types', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: OpenAPIV3.SchemaObject = {
                type: 'string'
            };

            modifier.convertNullTypeToNullValue(schema);

            expect(schema.type).toBe('string');
        });
    });

    describe('deduplicateEnumValue', () => {
        it('should remove duplicate enum values (case-insensitive)', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                enum: ['AND', 'and', 'OR', 'or']
            };

            modifier.deduplicateEnumValue(schema);

            expect(schema.enum).toHaveLength(2);
            expect(schema.enum).toContain('and');
            expect(schema.enum).toContain('or');
        });

        it('should handle enum with unique values', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                enum: ['red', 'green', 'blue']
            };

            modifier.deduplicateEnumValue(schema);

            expect(schema.enum).toHaveLength(3);
        });
    });


    describe('convertAdditionalPropertiesToProperty', () => {
        it('should convert additionalProperties with title to named property', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'object',
                properties: {
                    distance: { type: 'string' }
                },
                additionalProperties: {
                    title: 'location',
                    $ref: '#/components/schemas/GeoLocation'
                },
                minProperties: 2
            };

            modifier.convertAdditionalPropertiesToProperty(schema);

            expect(schema.properties.location).toBeDefined();
            expect(schema.properties.location.type).toBe('object');
            expect(schema.properties.location.additionalProperties).toEqual({
                $ref: '#/components/schemas/GeoLocation'
            });
            expect(schema.additionalProperties).toBeUndefined();
        });

        it('should not convert when minProperties=1 and maxProperties=1', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'object',
                additionalProperties: {
                    title: 'field',
                    type: 'string'
                },
                minProperties: 1,
                maxProperties: 1
            };

            modifier.convertAdditionalPropertiesToProperty(schema);

            expect(schema.additionalProperties).toBeDefined();
            expect(schema.properties).toBeUndefined();
        });

        it('should not convert when additionalProperties has no title', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'object',
                additionalProperties: {
                    type: 'string'
                }
            };

            modifier.convertAdditionalPropertiesToProperty(schema);

            expect(schema.additionalProperties).toEqual({ type: 'string' });
        });
    });

    describe('convertOneOfToMinMaxProperties', () => {
        it('should convert oneOf single properties to minProperties/maxProperties', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    { properties: { field1: { type: 'string' } }, required: ['field1'] },
                    { properties: { field2: { type: 'number' } }, required: ['field2'] }
                ]
            };

            modifier.convertOneOfToMinMaxProperties(schema);

            expect(schema.oneOf).toBeUndefined();
            expect(schema.properties).toEqual({
                field1: { type: 'string' },
                field2: { type: 'number' }
            });
            expect(schema.minProperties).toBe(1);
            expect(schema.maxProperties).toBe(1);
        });

        it('should not convert when items have multiple properties', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    {
                        properties: {
                            field1: { type: 'string' },
                            field2: { type: 'string' }
                        },
                        required: ['field1']
                    }
                ]
            };

            modifier.convertOneOfToMinMaxProperties(schema);

            expect(schema.oneOf).toBeDefined();
        });
    });

    describe('markOneOfExtensions', () => {
        it('should mark properties with x-oneof-property when maxProperties=1', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'object',
                properties: {
                    field1: { type: 'string' },
                    field2: { type: 'number' }
                },
                maxProperties: 1
            };

            modifier.markOneOfExtensions(schema);

            expect(schema.properties.field1['x-oneof-property']).toBe(true);
            expect(schema.properties.field2['x-oneof-property']).toBe(true);
            expect(schema['x-oneof-schema']).toBe(true);
        });

        it('should mark parent schema when nested oneOf pattern exists', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                allOf: [
                    { properties: { meta: { type: 'string' } } },
                    { maxProperties: 1, properties: { field: { type: 'string' } } }
                ]
            };

            modifier.markOneOfExtensions(schema);

            expect(schema['x-oneof-schema']).toBe(true);
        });

        it('should not mark schemas without oneOf pattern', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'object',
                properties: {
                    field: { type: 'string' }
                }
            };

            modifier.markOneOfExtensions(schema);

            expect(schema['x-oneof-schema']).toBeUndefined();
        });
    });

    describe('collapseOneOfObjectPropContainsTitleSchema', () => {
        it('should collapse when simple schema title matches complex property with $ref', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestValue = { type: 'string' };

            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    { title: 'testField', $ref: '#/components/schemas/TestValue' },
                    {
                        type: 'object',
                        properties: {
                            testField: { $ref: '#/components/schemas/TestValue' }
                        }
                    }
                ]
            };

            modifier.collapseOneOfObjectPropContainsTitleSchema(schema);

            expect(schema.oneOf).toBeUndefined();
            expect(schema.type).toBe('object');
        });

        it('should not collapse when oneOf length is not 2', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    { title: 'field', type: 'string' }
                ]
            };

            modifier.collapseOneOfObjectPropContainsTitleSchema(schema);

            expect(schema.oneOf).toHaveLength(1);
        });

        it('should handle complex schema with allOf', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    { title: 'field', type: 'string' },
                    {
                        allOf: [
                            {
                                type: 'object',
                                properties: {
                                    field: { type: 'string' }
                                }
                            }
                        ]
                    }
                ]
            };

            modifier.collapseOneOfObjectPropContainsTitleSchema(schema);

            // Should collapse because field matches
            expect(schema.oneOf).toBeUndefined();
        });
    });

    describe('simplifySingleMapSchema', () => {
        it('should create new map schema and reference it', () => {
            const doc = createDocument();
            doc.components!.schemas!.SortOrder = {
                type: 'string',
                enum: ['asc', 'desc']
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = {
                type: 'object',
                additionalProperties: {
                    $ref: '#/components/schemas/SortOrder'
                },
                minProperties: 1,
                maxProperties: 1
            };

            modifier.simplifySingleMapSchema(schema, visit);

            // Schema should be replaced with $ref
            expect(schema.$ref).toBe('#/components/schemas/SortOrderSingleMap');
            expect(schema.type).toBeUndefined();
            expect(schema.properties).toBeUndefined();

            // New SortOrderSingleMap schema should be created
            expect(doc.components!.schemas!.SortOrderSingleMap).toBeDefined();
            const mapSchema = doc.components!.schemas!.SortOrderSingleMap as OpenAPIV3.SchemaObject;
            expect(mapSchema.type).toBe('object');
            expect(mapSchema.properties!.field).toEqual({ type: 'string' });
            expect(mapSchema.properties!.sort_order).toEqual({
                $ref: '#/components/schemas/SortOrder'
            });
            expect(mapSchema.required).toEqual(['field', 'sort_order']);
        });

        it('should use propertyNames ref for field property', () => {
            const doc = createDocument();
            doc.components!.schemas!.Field = {
                type: 'string'
            };
            doc.components!.schemas!.SortOrder = {
                type: 'string'
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = {
                type: 'object',
                propertyNames: {
                    $ref: '#/components/schemas/Field'
                },
                additionalProperties: {
                    $ref: '#/components/schemas/SortOrder'
                },
                minProperties: 1,
                maxProperties: 1
            };

            modifier.simplifySingleMapSchema(schema, visit);

            // Check new map schema uses propertyNames for field
            const mapSchema = doc.components!.schemas!.SortOrderSingleMap as OpenAPIV3.SchemaObject;
            expect(mapSchema.properties!.field).toEqual({
                $ref: '#/components/schemas/Field'
            });
        });

        it('should use propertyNames title as field property name', () => {
            const doc = createDocument();
            doc.components!.schemas!.SortOrder = {
                type: 'string',
                enum: ['asc', 'desc']
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = {
                type: 'object',
                propertyNames: {
                    title: 'customField',
                    type: 'string'
                },
                additionalProperties: {
                    $ref: '#/components/schemas/SortOrder'
                },
                minProperties: 1,
                maxProperties: 1
            };

            modifier.simplifySingleMapSchema(schema, visit);

            // Check that the title is used as the field property name
            const mapSchema = doc.components!.schemas!.SortOrderSingleMap as OpenAPIV3.SchemaObject;
            expect(mapSchema.properties!.customField).toBeDefined();
            expect(mapSchema.properties!.customField).toEqual({ type: 'string' });
            expect(mapSchema.properties!.sort_order).toEqual({
                $ref: '#/components/schemas/SortOrder'
            });
            expect(mapSchema.required).toEqual(['customField', 'sort_order']);
        });

        it('should convert PascalCase to snake_case for property name', () => {
            const doc = createDocument();
            doc.components!.schemas!.MyComplexType = {
                type: 'object',
                properties: {
                    prop1: { type: 'string' }
                }
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = {
                type: 'object',
                additionalProperties: {
                    $ref: '#/components/schemas/MyComplexType'
                },
                minProperties: 1,
                maxProperties: 1
            };

            modifier.simplifySingleMapSchema(schema, visit);

            expect(doc.components!.schemas!.MyComplexTypeSingleMap).toBeDefined();
            const mapSchema = doc.components!.schemas!.MyComplexTypeSingleMap as OpenAPIV3.SchemaObject;
            expect(mapSchema.properties!.my_complex_type).toBeDefined();
        });

        it('should not modify when not single-key map', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = {
                type: 'object',
                additionalProperties: { type: 'string' },
                minProperties: 1,
                maxProperties: 2
            };

            modifier.simplifySingleMapSchema(schema, visit);

            expect(schema.additionalProperties).toBeDefined();
        });

        it('should use inline modification for QueryContainer properties', () => {
            const doc = createDocument();
            doc.components!.schemas!.BoolQuery = {
                type: 'object',
                properties: {
                    must: { 
                        type: 'array',
                        items: { type: 'string' }
                    }
                }
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = {
                type: 'object',
                additionalProperties: {
                    $ref: '#/components/schemas/BoolQuery'
                },
                minProperties: 1,
                maxProperties: 1
            };

            // Pass 'QueryContainer' as parent schema name
            modifier.simplifySingleMapSchema(schema, visit, 'QueryContainer');

            // Should use old inline behavior - becomes a $ref directly (no SingleMap wrapper)
            expect(schema.$ref).toBe('#/components/schemas/BoolQuery');
            expect(doc.components!.schemas!.BoolQuerySingleMap).toBeUndefined();
            
            // Properties should be deleted
            expect(schema.type).toBeUndefined();
            expect(schema.additionalProperties).toBeUndefined();
            expect(schema.minProperties).toBeUndefined();
            expect(schema.maxProperties).toBeUndefined();
        });

        it('should create SingleMap for non-QueryContainer properties', () => {
            const doc = createDocument();
            doc.components!.schemas!.SortOrder = {
                type: 'string',
                enum: ['asc', 'desc']
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = {
                type: 'object',
                additionalProperties: {
                    $ref: '#/components/schemas/SortOrder'
                },
                minProperties: 1,
                maxProperties: 1
            };

            // Pass a different parent schema name (not QueryContainer)
            modifier.simplifySingleMapSchema(schema, visit, 'AggregateOrder');

            // Should use new SingleMap behavior
            expect(schema.$ref).toBe('#/components/schemas/SortOrderSingleMap');
            expect(doc.components!.schemas!.SortOrderSingleMap).toBeDefined();
        });
    });

    describe('convertAdditionalPropertiesToProperty - edge cases', () => {
        it('should skip conversion when property already exists', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'object',
                properties: {
                    location: { type: 'string' }
                },
                additionalProperties: {
                    title: 'location',
                    type: 'string'
                },
                minProperties: 2
            };

            modifier.convertAdditionalPropertiesToProperty(schema);

            // Should not convert because property already exists
            expect(schema.additionalProperties).toBeDefined();
        });

        it('should create properties object if not exists', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'object',
                additionalProperties: {
                    title: 'newField',
                    type: 'string'
                }
            };

            modifier.convertAdditionalPropertiesToProperty(schema);

            expect(schema.properties).toBeDefined();
            expect(schema.properties.newField).toBeDefined();
        });

        it('should handle additionalProperties without schema definition', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'object',
                additionalProperties: {
                    title: 'field'
                }
            };

            modifier.convertAdditionalPropertiesToProperty(schema);

            expect(schema.properties.field.additionalProperties).toBe(true);
        });

        it('should delete propertyNames after conversion', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                type: 'object',
                propertyNames: { type: 'string' },
                additionalProperties: {
                    title: 'field',
                    type: 'string'
                }
            };

            modifier.convertAdditionalPropertiesToProperty(schema);

            expect(schema.propertyNames).toBeUndefined();
        });
    });

    describe('convertOneOfToMinMaxProperties - edge cases', () => {
        it('should handle oneOf with $ref items', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    { $ref: '#/components/schemas/Field1' },
                    { properties: { field2: { type: 'string' } }, required: ['field2'] }
                ]
            };

            modifier.convertOneOfToMinMaxProperties(schema);

            // Should not convert because of $ref
            expect(schema.oneOf).toBeDefined();
        });

        it('should handle empty oneOf', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: []
            };

            modifier.convertOneOfToMinMaxProperties(schema);

            expect(schema.oneOf).toEqual([]);
        });

        it('should delete unevaluatedProperties when flattening', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);

            const schema: any = {
                oneOf: [
                    { properties: { field1: { type: 'string' } }, required: ['field1'] }
                ],
                unevaluatedProperties: false
            };

            modifier.convertOneOfToMinMaxProperties(schema);

            expect(schema.unevaluatedProperties).toBeUndefined();
        });
    });

    describe('reconstructAdditionalPropertySchema', () => {
        it('should add field to allOf schema', () => {
            const doc = createDocument();
            doc.components!.schemas!.Base = {
                allOf: [
                    { type: 'object', properties: { id: { type: 'string' } } }
                ]
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema = { $ref: '#/components/schemas/Base' };
            modifier.reconstructAdditionalPropertySchema(schema, visit);

            const baseSchema = doc.components!.schemas!.Base as any;
            expect(baseSchema.allOf.length).toBeGreaterThan(1);
        });


        it('should handle primitive types with title', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = { type: 'string', title: 'customValue' };
            const result = modifier.reconstructAdditionalPropertySchema(schema, visit);

            expect(result).toHaveProperty('properties');
            expect((result as any).properties).toHaveProperty('customValue');
        });

        it('should handle oneOf schemas recursively', () => {
            const doc = createDocument();
            doc.components!.schemas!.OptionA = {
                type: 'object',
                properties: { a: { type: 'string' } }
            };
            doc.components!.schemas!.OptionB = {
                type: 'object',
                properties: { b: { type: 'number' } }
            };
            doc.components!.schemas!.UnionType = {
                oneOf: [
                    { $ref: '#/components/schemas/OptionA' },
                    { $ref: '#/components/schemas/OptionB' }
                ]
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema = { $ref: '#/components/schemas/UnionType' };
            modifier.reconstructAdditionalPropertySchema(schema, visit);

            const optionA = doc.components!.schemas!.OptionA as any;
            const optionB = doc.components!.schemas!.OptionB as any;
            
            // Both options should have the field property added
            expect(optionA.properties).toHaveProperty('field');
            expect(optionB.properties).toHaveProperty('field');
        });

        it('should handle anyOf schemas recursively', () => {
            const doc = createDocument();
            doc.components!.schemas!.OptionC = {
                type: 'object',
                properties: { c: { type: 'string' } }
            };
            doc.components!.schemas!.OptionD = {
                type: 'object',
                properties: { d: { type: 'number' } }
            };
            doc.components!.schemas!.FlexibleType = {
                anyOf: [
                    { $ref: '#/components/schemas/OptionC' },
                    { $ref: '#/components/schemas/OptionD' }
                ]
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema = { $ref: '#/components/schemas/FlexibleType' };
            modifier.reconstructAdditionalPropertySchema(schema, visit);

            const optionC = doc.components!.schemas!.OptionC as any;
            const optionD = doc.components!.schemas!.OptionD as any;
            
            // Both options should have the field property added
            expect(optionC.properties).toHaveProperty('field');
            expect(optionD.properties).toHaveProperty('field');
        });

        it('should return original schema if already visited', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestSchema = {
                type: 'object',
                properties: { test: { type: 'string' } }
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();
            
            const schema = { $ref: '#/components/schemas/TestSchema' };
            const resolvedSchema = doc.components!.schemas!.TestSchema;
            
            visit.add(resolvedSchema);
            
            const result = modifier.reconstructAdditionalPropertySchema(schema, visit);
            
            // Should return original schema without modification
            expect(result).toBe(schema);
            expect((resolvedSchema as any).properties).not.toHaveProperty('field');
        });

        it('should handle primitive types without title', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = { type: 'number' };
            const result = modifier.reconstructAdditionalPropertySchema(schema, visit);

            expect(result).toHaveProperty('properties');
            expect((result as any).properties).toHaveProperty('value');
        });

        it('should log error when field property already exists', () => {
            const doc = createDocument();
            doc.components!.schemas!.ConflictSchema = {
                type: 'object',
                properties: {
                    field: { type: 'string' },
                    existing: { type: 'number' }
                }
            };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema = { $ref: '#/components/schemas/ConflictSchema' };
            
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            modifier.reconstructAdditionalPropertySchema(schema, visit);
            
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('getTypeName', () => {
        it('should extract name from $ref', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc) as any;

            const schema = { $ref: '#/components/schemas/TestType' };
            const result = modifier.getTypeName(schema);

            expect(result).toBe('TestType');
        });

        it('should extract name from title', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc) as any;

            const schema: OpenAPIV3.SchemaObject = { type: 'object', title: 'CustomTitle' };
            const result = modifier.getTypeName(schema);

            expect(result).toBe('CustomTitle');
        });

        it('should return null if no $ref or title', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc) as any;

            const schema: OpenAPIV3.SchemaObject = { type: 'string' };
            const result = modifier.getTypeName(schema);

            expect(result).toBeNull();
        });
    });

    describe('createAdditionalPropertySchema', () => {
        it('should create schema with field property', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc) as any;

            const result = modifier.createAdditionalPropertySchema();

            expect(result.type).toBe('object');
            expect(result.properties).toHaveProperty('field');
            expect(result.properties!.field).toEqual({ type: 'string' });
        });
    });

    describe('isArraySchemaObject', () => {
        it('should return true for array schema with items', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc) as any;

            const schema: OpenAPIV3.ArraySchemaObject = {
                type: 'array',
                items: { type: 'string' }
            };

            const result = modifier.isArraySchemaObject(schema);
            expect(result).toBe(true);
        });

        it('should return false for non-array schema', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc) as any;

            const schema: OpenAPIV3.SchemaObject = {
                type: 'object'
            };

            const result = modifier.isArraySchemaObject(schema);
            expect(result).toBe(false);
        });

        it('should return false for array without items', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc) as any;

            const schema: any = {
                type: 'array'
            };

            const result = modifier.isArraySchemaObject(schema);
            expect(result).toBe(false);
        });
    });
});
