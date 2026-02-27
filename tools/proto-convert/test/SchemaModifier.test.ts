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
        it('should create wrapper schema with sanitized names (real-world usage)', () => {
            const doc = createDocument();
            // After Sanitizer runs, schema names have '___' prefixes removed
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

            expect(schema.type).toBe('object');
            expect(schema.title).toBe('SortOrderMap');
            expect(schema.properties).toBeDefined();
            expect(schema.properties.field).toEqual({ type: 'string' });
            expect(schema.properties.sort_order).toEqual({
                $ref: '#/components/schemas/SortOrder'
            });
            expect(schema.required).toEqual(['field', 'sort_order']);
            expect(schema.additionalProperties).toBeUndefined();
            expect(schema.minProperties).toBeUndefined();
            expect(schema.maxProperties).toBeUndefined();
        });

        it('should handle schema with title', () => {
            const doc = createDocument();
            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = {
                type: 'object',
                title: 'CustomTitle',
                additionalProperties: {
                    type: 'string',
                    title: 'Value'
                },
                minProperties: 1,
                maxProperties: 1
            };

            modifier.simplifySingleMapSchema(schema, visit);

            expect(schema.title).toBe('CustomTitle');
            expect(schema.properties.field).toBeDefined();
            expect(schema.properties.value).toEqual({ type: 'string', title: 'Value' });
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

            expect(schema.properties.my_complex_type).toBeDefined();
        });

        it('should remove propertyNames if present', () => {
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

            expect(schema.propertyNames).toBeUndefined();
            expect(schema.properties.field).toBeDefined();
            expect(schema.properties.sort_order).toBeDefined();
        });

        it('should rename value property to field_value when type name collides with field', () => {
            const doc = createDocument();
            doc.components!.schemas!.Field = { type: 'string' };

            const modifier = new SchemaModifier(doc);
            const visit = new Set();

            const schema: any = {
                type: 'object',
                additionalProperties: {
                    $ref: '#/components/schemas/Field'
                },
                minProperties: 1,
                maxProperties: 1
            };

            modifier.simplifySingleMapSchema(schema, visit);

            expect(schema.properties.field).toEqual({ type: 'string' });
            expect(schema.properties.field_value).toEqual({ $ref: '#/components/schemas/Field' });
            expect(schema.required).toEqual(['field', 'field_value']);
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
    });
});
