/**
 * Tests for OpenApiTraverser.
 */

import type { OpenAPIV3 } from 'openapi-types';
import { traverse, traverseSchema } from '../../src/utils/OpenApiTraverser';

describe('OpenApiTraverser', () => {
    const createDocument = (): OpenAPIV3.Document => ({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
    });

    describe('traverse', () => {
        it('should call onSchema for component schemas', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                }
            };

            const onSchema = jest.fn();
            traverse(doc, { onSchema });

            expect(onSchema).toHaveBeenCalledWith(
                doc.components!.schemas!.TestSchema,
                'TestSchema'
            );
        });

        it('should call onSchemaProperty for nested properties', () => {
            const doc = createDocument();
            doc.components!.schemas!.TestSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer' }
                }
            };

            const onSchemaProperty = jest.fn();
            traverse(doc, { onSchemaProperty });

            expect(onSchemaProperty).toHaveBeenCalledWith(
                { type: 'string' },
                'name',
                'TestSchema'
            );
            expect(onSchemaProperty).toHaveBeenCalledWith(
                { type: 'integer' },
                'age',
                'TestSchema'
            );
        });

        it('should pass parent schema name to onSchemaProperty', () => {
            const doc = createDocument();
            doc.components!.schemas!.ParentSchema = {
                type: 'object',
                properties: {
                    child: { 
                        type: 'object',
                        properties: {
                            nested: { type: 'string' }
                        }
                    }
                }
            };

            const onSchemaProperty = jest.fn();
            traverse(doc, { onSchemaProperty });

            // Should be called with parent schema name 'ParentSchema'
            const childCall = onSchemaProperty.mock.calls.find(
                call => call[1] === 'child'
            );
            expect(childCall).toBeDefined();
            expect(childCall![2]).toBe('ParentSchema');
        });

        it('should call onResponseSchema for response schemas', () => {
            const doc = createDocument();
            doc.components!.responses = {
                TestResponse: {
                    description: 'Test',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    result: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            };

            const onResponseSchema = jest.fn();
            traverse(doc, { onResponseSchema });

            expect(onResponseSchema).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'object' }),
                'TestResponse'
            );
        });

        it('should call onRequestSchema for request body schemas', () => {
            const doc = createDocument();
            doc.components!.requestBodies = {
                TestRequest: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    data: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            };

            const onRequestSchema = jest.fn();
            traverse(doc, { onRequestSchema });

            expect(onRequestSchema).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'object' }),
                'TestRequest'
            );
        });

        it('should call onParameter for parameters', () => {
            const doc = createDocument();
            doc.components!.parameters = {
                TestParam: {
                    name: 'test',
                    in: 'query',
                    schema: { type: 'string' }
                }
            };

            const onParameter = jest.fn();
            traverse(doc, { onParameter });

            expect(onParameter).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'test' }),
                'TestParam'
            );
        });

        it('should skip $ref objects', () => {
            const doc = createDocument();
            doc.components!.schemas!.RefSchema = {
                $ref: '#/components/schemas/OtherSchema'
            };

            const onSchemaProperty = jest.fn();
            traverse(doc, { onSchemaProperty });

            // Should not traverse into $ref objects
            expect(onSchemaProperty).not.toHaveBeenCalled();
        });

        it('should handle empty components', () => {
            const doc: OpenAPIV3.Document = {
                openapi: '3.0.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {}
            };

            const onSchema = jest.fn();
            expect(() => traverse(doc, { onSchema })).not.toThrow();
            expect(onSchema).not.toHaveBeenCalled();
        });
    });

    describe('traverseSchema', () => {
        it('should traverse array items', () => {
            const schema: OpenAPIV3.SchemaObject = {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    }
                }
            };

            const onSchemaProperty = jest.fn();
            traverseSchema(schema, { onSchemaProperty });

            // Should be called for items
            expect(onSchemaProperty).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'object' }),
                'items',
                undefined
            );
            
            // Should also be called for nested properties
            expect(onSchemaProperty).toHaveBeenCalledWith(
                { type: 'string' },
                'name',
                undefined
            );
        });

        it('should traverse array items with parent schema name', () => {
            const schema: OpenAPIV3.SchemaObject = {
                type: 'array',
                items: {
                    type: 'string'
                }
            };

            const onSchemaProperty = jest.fn();
            traverseSchema(schema, { onSchemaProperty }, 'ParentSchema');

            expect(onSchemaProperty).toHaveBeenCalledWith(
                { type: 'string' },
                'items',
                'ParentSchema'
            );
        });

        it('should traverse additionalProperties', () => {
            const schema: OpenAPIV3.SchemaObject = {
                type: 'object',
                additionalProperties: {
                    type: 'string'
                }
            };

            const onSchemaProperty = jest.fn();
            traverseSchema(schema, { onSchemaProperty });

            // additionalProperties are traversed but not passed to onSchemaProperty
            // (they don't have a property name)
            expect(onSchemaProperty).not.toHaveBeenCalled();
        });

        it('should traverse allOf schemas', () => {
            const schema: OpenAPIV3.SchemaObject = {
                allOf: [
                    { type: 'object', properties: { a: { type: 'string' } } },
                    { type: 'object', properties: { b: { type: 'number' } } }
                ]
            };

            const onSchema = jest.fn();
            const onSchemaProperty = jest.fn();
            traverseSchema(schema, { onSchema, onSchemaProperty });

            expect(onSchema).toHaveBeenCalledTimes(2);
            expect(onSchemaProperty).toHaveBeenCalledWith(
                { type: 'string' },
                'a',
                undefined
            );
            expect(onSchemaProperty).toHaveBeenCalledWith(
                { type: 'number' },
                'b',
                undefined
            );
        });

        it('should traverse anyOf schemas', () => {
            const schema: OpenAPIV3.SchemaObject = {
                anyOf: [
                    { type: 'string' },
                    { type: 'number' }
                ]
            };

            const onSchema = jest.fn();
            traverseSchema(schema, { onSchema });

            expect(onSchema).toHaveBeenCalledTimes(2);
        });

        it('should traverse oneOf schemas', () => {
            const schema: OpenAPIV3.SchemaObject = {
                oneOf: [
                    { type: 'string' },
                    { type: 'number' }
                ]
            };

            const onSchema = jest.fn();
            traverseSchema(schema, { onSchema });

            expect(onSchema).toHaveBeenCalledTimes(2);
        });

        it('should skip $ref in composed schemas', () => {
            const schema: OpenAPIV3.SchemaObject = {
                allOf: [
                    { $ref: '#/components/schemas/Base' },
                    { type: 'object', properties: { extra: { type: 'string' } } }
                ]
            };

            const onSchema = jest.fn();
            traverseSchema(schema, { onSchema });

            // Should only be called for the non-$ref item
            expect(onSchema).toHaveBeenCalledTimes(1);
        });

        it('should handle deeply nested schemas', () => {
            const schema: OpenAPIV3.SchemaObject = {
                type: 'object',
                properties: {
                    level1: {
                        type: 'object',
                        properties: {
                            level2: {
                                type: 'object',
                                properties: {
                                    level3: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            };

            const onSchemaProperty = jest.fn();
            traverseSchema(schema, { onSchemaProperty });

            // Should be called for all levels
            expect(onSchemaProperty).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'object' }),
                'level1',
                undefined
            );
            expect(onSchemaProperty).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'object' }),
                'level2',
                undefined
            );
            expect(onSchemaProperty).toHaveBeenCalledWith(
                { type: 'string' },
                'level3',
                undefined
            );
        });

        it('should handle empty schema', () => {
            const onSchemaProperty = jest.fn();
            
            // @ts-ignore - testing runtime behavior
            traverseSchema(null, { onSchemaProperty });
            
            expect(onSchemaProperty).not.toHaveBeenCalled();
        });
    });
});
