/**
 * Tests for helper utility functions.
 */

import {
    getSchemaNames,
    compressMultipleUnderscores,
    toSnakeCase,
    resolveRef,
    resolveObj,
    isPrimitiveType,
    isEmptyObjectSchema,
    isReferenceObject,
    deleteMatchingKeys,
    find_refs,
    is_simple_ref,
    remove_unused
} from '../../src/utils/helper';
import { OpenAPIV3 } from 'openapi-types';

describe('getSchemaNames', () => {
    it('should extract full and short names from schema ref', () => {
        const result = getSchemaNames('#/components/schemas/_common___Pet');

        expect(result).toEqual({
            full: '_common___Pet',
            short: 'Pet'
        });
    });

    it('should return same name for full and short when no namespace separator', () => {
        const result = getSchemaNames('#/components/schemas/Pet');

        expect(result).toEqual({
            full: 'Pet',
            short: 'Pet'
        });
    });

    it('should return null for non-schema refs', () => {
        expect(getSchemaNames('#/components/parameters/limit')).toBeNull();
        expect(getSchemaNames('#/components/responses/200')).toBeNull();
        expect(getSchemaNames('/some/other/path')).toBeNull();
    });

    it('should handle empty ref', () => {
        expect(getSchemaNames('')).toBeNull();
    });
});

describe('compressMultipleUnderscores', () => {
    it('should compress multiple underscores to single', () => {
        expect(compressMultipleUnderscores('hello__world')).toBe('hello_world');
        expect(compressMultipleUnderscores('a___b____c')).toBe('a_b_c');
    });

    it('should not change single underscores', () => {
        expect(compressMultipleUnderscores('hello_world')).toBe('hello_world');
    });

    it('should handle string without underscores', () => {
        expect(compressMultipleUnderscores('helloworld')).toBe('helloworld');
    });
});

describe('toSnakeCase', () => {
    it('should convert PascalCase to snake_case', () => {
        expect(toSnakeCase('SortOrder')).toBe('sort_order');
        expect(toSnakeCase('MyComplexType')).toBe('my_complex_type');
        expect(toSnakeCase('APIResponse')).toBe('api_response');
    });

    it('should convert camelCase to snake_case', () => {
        expect(toSnakeCase('sortOrder')).toBe('sort_order');
        expect(toSnakeCase('myComplexType')).toBe('my_complex_type');
    });

    it('should handle already snake_case strings', () => {
        expect(toSnakeCase('already_snake_case')).toBe('already_snake_case');
    });

    it('should handle single word strings', () => {
        expect(toSnakeCase('word')).toBe('word');
        expect(toSnakeCase('Word')).toBe('word');
    });

    it('should handle empty string', () => {
        expect(toSnakeCase('')).toBe('');
    });

    it('should handle consecutive capitals', () => {
        expect(toSnakeCase('HTTPSConnection')).toBe('https_connection');
        expect(toSnakeCase('APIResponse')).toBe('api_response');
        expect(toSnakeCase('URLPath')).toBe('url_path');
        expect(toSnakeCase('GeoIP')).toBe('geo_ip');
    });
});

describe('resolveRef', () => {
    const doc = {
        components: {
            schemas: {
                Pet: { type: 'object', properties: { name: { type: 'string' } } },
                Owner: { type: 'object' }
            },
            parameters: {
                limit: { name: 'limit', in: 'query' }
            }
        }
    };

    it('should resolve schema reference', () => {
        const result = resolveRef('#/components/schemas/Pet', doc);

        expect(result).toEqual({ type: 'object', properties: { name: { type: 'string' } } });
    });

    it('should resolve parameter reference', () => {
        const result = resolveRef('#/components/parameters/limit', doc);

        expect(result).toEqual({ name: 'limit', in: 'query' });
    });

    it('should return undefined for non-existent reference', () => {
        const result = resolveRef('#/components/schemas/NonExistent', doc);

        expect(result).toBeUndefined();
    });
});

describe('resolveObj', () => {
    const doc: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
            schemas: {
                Pet: { type: 'object' }
            }
        }
    };

    it('should return schema object directly', () => {
        const schema: OpenAPIV3.SchemaObject = { type: 'string' };
        const result = resolveObj(schema, doc);

        expect(result).toEqual({ type: 'string' });
    });

    it('should resolve reference object', () => {
        const ref: OpenAPIV3.ReferenceObject = { $ref: '#/components/schemas/Pet' };
        const result = resolveObj(ref, doc);

        expect(result).toEqual({ type: 'object' });
    });

    it('should return undefined for undefined input', () => {
        const result = resolveObj(undefined, doc);

        expect(result).toBeUndefined();
    });
});

describe('isPrimitiveType', () => {
    it('should return true for primitive types', () => {
        expect(isPrimitiveType({ type: 'string' })).toBe(true);
        expect(isPrimitiveType({ type: 'number' })).toBe(true);
        expect(isPrimitiveType({ type: 'integer' })).toBe(true);
        expect(isPrimitiveType({ type: 'boolean' })).toBe(true);
    });

    it('should return false for array type', () => {
        expect(isPrimitiveType({ type: 'array', items: { type: 'string' } })).toBe(false);
    });

    it('should return false for object type', () => {
        expect(isPrimitiveType({ type: 'object' })).toBe(false);
    });

    it('should return false for undefined type', () => {
        expect(isPrimitiveType({})).toBe(false);
    });
});

describe('isEmptyObjectSchema', () => {
    it('should return true for empty object schema', () => {
        expect(isEmptyObjectSchema({ type: 'object' })).toBe(true);
    });

    it('should return false for object with properties', () => {
        expect(isEmptyObjectSchema({
            type: 'object',
            properties: { name: { type: 'string' } }
        })).toBe(false);
    });

    it('should return false for object with allOf', () => {
        expect(isEmptyObjectSchema({
            type: 'object',
            allOf: [{ type: 'object' }]
        })).toBe(false);
    });

    it('should return false for object with anyOf', () => {
        expect(isEmptyObjectSchema({
            type: 'object',
            anyOf: [{ type: 'string' }]
        })).toBe(false);
    });

    it('should return false for object with oneOf', () => {
        expect(isEmptyObjectSchema({
            type: 'object',
            oneOf: [{ type: 'string' }]
        })).toBe(false);
    });

    it('should return false for non-object types', () => {
        expect(isEmptyObjectSchema({ type: 'string' })).toBe(false);
    });
});

describe('isReferenceObject', () => {
    it('should return true for reference object', () => {
        expect(isReferenceObject({ $ref: '#/components/schemas/Pet' })).toBe(true);
    });

    it('should return false for schema object', () => {
        expect(isReferenceObject({ type: 'string' })).toBe(false);
    });

    it('should return false for null', () => {
        expect(isReferenceObject(null)).toBe(false);
    });

    it('should return false for non-object', () => {
        expect(isReferenceObject('string')).toBe(false);
        expect(isReferenceObject(123)).toBe(false);
    });
});

describe('deleteMatchingKeys', () => {
    it('should delete matching keys from object', () => {
        const obj = {
            a: { delete: true },
            b: { keep: true },
            c: { delete: true }
        };

        deleteMatchingKeys(obj, (item) => item.delete === true);

        expect(obj).toEqual({ b: { keep: true } });
    });

    it('should delete nested matching keys', () => {
        const obj = {
            level1: {
                level2: {
                    delete: { shouldDelete: true },
                    keep: { shouldDelete: false }
                }
            }
        };

        deleteMatchingKeys(obj, (item) => item.shouldDelete === true);

        expect(obj.level1.level2.delete).toBeUndefined();
        expect(obj.level1.level2.keep).toEqual({ shouldDelete: false });
    });

    it('should compact arrays after deletion', () => {
        const obj = {
            items: [
                { delete: true },
                { keep: true },
                { delete: true }
            ]
        };

        deleteMatchingKeys(obj, (item) => item.delete === true);

        expect(obj.items).toEqual([{ keep: true }]);
    });
});

describe('find_refs', () => {
    it('should find all references in spec', () => {
        const spec = {
            paths: {
                '/pets': {
                    get: {
                        responses: {
                            '200': { $ref: '#/components/responses/PetList' }
                        }
                    }
                }
            },
            components: {
                responses: {
                    PetList: {
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Pet' }
                            }
                        }
                    }
                },
                schemas: {
                    Pet: { type: 'object' }
                }
            }
        };

        const refs = find_refs(spec);

        expect(refs.has('#/components/responses/PetList')).toBe(true);
        expect(refs.has('#/components/schemas/Pet')).toBe(true);
    });

    it('should handle circular references', () => {
        const spec = {
            paths: {
                '/items': {
                    get: {
                        responses: {
                            '200': { $ref: '#/components/schemas/Item' }
                        }
                    }
                }
            },
            components: {
                schemas: {
                    Item: {
                        type: 'object',
                        properties: {
                            children: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/Item' }
                            }
                        }
                    }
                }
            }
        };

        // Should not throw or infinite loop
        const refs = find_refs(spec);

        expect(refs.has('#/components/schemas/Item')).toBe(true);
    });
});

describe('is_simple_ref', () => {
    it('should return true for simple ref', () => {
        expect(is_simple_ref({ $ref: '#/components/schemas/Pet' })).toBe(true);
    });

    it('should return false for ref with additional properties', () => {
        expect(is_simple_ref({
            $ref: '#/components/schemas/Pet',
            description: 'A pet'
        })).toBe(false);
    });

    it('should return false for non-ref object', () => {
        expect(is_simple_ref({ type: 'string' })).toBe(false);
    });

    it('should return false for null or undefined', () => {
        expect(is_simple_ref(null)).toBe(false);
        expect(is_simple_ref(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
        expect(is_simple_ref('string')).toBe(false);
    });
});

describe('remove_unused', () => {
    // Helper to create a spec with paths that reference the schema
    const createSpecWithPath = (schema: any, schemaName: string = 'TestSchema') => ({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
            '/test': {
                get: {
                    responses: {
                        '200': {
                            content: {
                                'application/json': {
                                    schema: { $ref: `#/components/schemas/${schemaName}` }
                                }
                            }
                        }
                    }
                }
            }
        },
        components: {
            schemas: {
                [schemaName]: schema
            }
        }
    });

    it('should remove objects with empty properties from oneOf', () => {
        const spec: any = createSpecWithPath({
            oneOf: [
                { properties: {}, required: ['removed_schema'] },
                { properties: { name: { type: 'string' } }, required: ['name'] },
                { properties: {}, required: ['another_removed'] }
            ]
        });

        remove_unused(spec);

        expect(spec.components.schemas.TestSchema.oneOf).toHaveLength(1);
        expect(spec.components.schemas.TestSchema.oneOf[0].properties).toEqual({ name: { type: 'string' } });
    });

    it('should remove objects with empty properties from anyOf', () => {
        const spec: any = createSpecWithPath({
            anyOf: [
                { properties: {} },
                { type: 'string' },
                { properties: {} }
            ]
        });

        remove_unused(spec);

        expect(spec.components.schemas.TestSchema.anyOf).toHaveLength(1);
        expect(spec.components.schemas.TestSchema.anyOf[0]).toEqual({ type: 'string' });
    });

    it('should remove all items from oneOf if all have empty properties without type', () => {
        const spec: any = createSpecWithPath({
            type: 'object',
            oneOf: [
                { properties: {} },
                { properties: {} }
            ]
        });

        remove_unused(spec);

        // oneOf array should be empty (compacted)
        expect(spec.components.schemas.TestSchema.oneOf).toEqual([]);
        expect(spec.components.schemas.TestSchema.type).toBe('object');
    });

    it('should keep type: object with empty properties', () => {
        const spec: any = createSpecWithPath({
            oneOf: [
                { type: 'object', properties: {} },
                { properties: { name: { type: 'string' } } }
            ]
        });

        remove_unused(spec);

        // Should keep the type: object with empty properties
        expect(spec.components.schemas.TestSchema.oneOf).toHaveLength(2);
        expect(spec.components.schemas.TestSchema.oneOf[0]).toEqual({ type: 'object', properties: {} });
    });

    it('should remove objects with empty properties from nested structures', () => {
        const spec: any = createSpecWithPath({
            allOf: [
                {
                    oneOf: [
                        { properties: {} },
                        { properties: { id: { type: 'integer' } } }
                    ]
                }
            ]
        }, 'Parent');

        remove_unused(spec);

        expect(spec.components.schemas.Parent.allOf[0].oneOf).toHaveLength(1);
        expect(spec.components.schemas.Parent.allOf[0].oneOf[0].properties).toEqual({ id: { type: 'integer' } });
    });

    it('should not remove objects with non-empty properties', () => {
        const spec: any = createSpecWithPath({
            oneOf: [
                { properties: { a: { type: 'string' } } },
                { properties: { b: { type: 'number' } } }
            ]
        });

        remove_unused(spec);

        expect(spec.components.schemas.TestSchema.oneOf).toHaveLength(2);
    });

    it('should remove unused schemas', () => {
        const spec: any = {
            openapi: '3.0.0',
            info: { title: 'Test', version: '1.0.0' },
            paths: {
                '/test': {
                    get: {
                        responses: {
                            '200': {
                                content: {
                                    'application/json': {
                                        schema: { $ref: '#/components/schemas/Used' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            components: {
                schemas: {
                    Used: { type: 'object' },
                    Unused: { type: 'string' }
                }
            }
        };

        remove_unused(spec);

        expect(spec.components.schemas.Used).toBeDefined();
        expect(spec.components.schemas.Unused).toBeUndefined();
    });
});
