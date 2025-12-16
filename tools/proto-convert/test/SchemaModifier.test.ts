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
});
