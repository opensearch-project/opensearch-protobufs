import { GlobalParameterConsolidator } from '../src/GlobalParamWrapper';
import { OpenAPIV3 } from 'openapi-types';

describe('GlobalParameterConsolidator', () => {
    describe('consolidate', () => {
        it('should consolidate global parameters and replace in operations', () => {
            const spec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/test': {
                        get: {
                            responses: {},
                            parameters: [
                                { $ref: '#/components/parameters/_global___query::pretty' },
                                { name: 'id', in: 'path', schema: { type: 'string' } }
                            ]
                        }
                    },
                    '/search': {
                        post: {
                            responses: {},
                            parameters: [
                                { $ref: '#/components/parameters/_global___query::pretty' },
                                { $ref: '#/components/parameters/_global___query::format' },
                                { name: 'query', in: 'body', schema: { type: 'string' } }
                            ]
                        }
                    }
                },
                components: {
                    parameters: {
                        '_global___query::pretty': {
                            name: 'pretty',
                            in: 'query',
                            description: 'Pretty print',
                            schema: { type: 'boolean' }
                        },
                        '_global___query::format': {
                            name: 'format',
                            in: 'query',
                            description: 'Response format',
                            schema: { type: 'string', enum: ['json', 'yaml'] }
                        },
                        'regular_param': {
                            name: 'id',
                            in: 'path',
                            schema: { type: 'string' }
                        }
                    }
                }
            };

            const consolidator = new GlobalParameterConsolidator(spec);
            const result = consolidator.consolidate();

            // Should create GlobalParams schema with only global parameters
            expect(result.components?.schemas?.GlobalParams).toBeDefined();
            const globalParams = result.components!.schemas!.GlobalParams as OpenAPIV3.SchemaObject;
            expect(globalParams.type).toBe('object');
            expect(globalParams.properties).toHaveProperty('pretty');
            expect(globalParams.properties).toHaveProperty('format');
            expect(globalParams.properties).not.toHaveProperty('id'); // regular param excluded

            // Should create globalParams parameter reference
            expect(result.components?.parameters?.globalParams).toBeDefined();
            const globalParam = result.components!.parameters!.globalParams as any;
            expect(globalParam.name).toBe('globalParams');
            expect(globalParam.in).toBe('query');
            expect(globalParam.schema.$ref).toBe('#/components/schemas/GlobalParams');

            // Should replace single global param in GET operation
            const getOp = result.paths!['/test']!.get!;
            expect(getOp.parameters).toHaveLength(2);
            expect(getOp.parameters).toContainEqual({ $ref: '#/components/parameters/globalParams' });

            // Should consolidate multiple global params into one in POST operation
            const postOp = result.paths!['/search']!.post!;
            expect(postOp.parameters).toHaveLength(2);
            const globalCount = postOp.parameters!.filter(p =>
                (p as any).$ref === '#/components/parameters/globalParams'
            ).length;
            expect(globalCount).toBe(1); // Only one globalParams reference
        });

        it('should handle edge cases', () => {
            // Test with no components/parameters
            const emptySpec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {},
                components: { parameters: {} }
            };

            const consolidator1 = new GlobalParameterConsolidator(emptySpec);
            const result1 = consolidator1.consolidate();
            expect(result1.components?.schemas?.GlobalParams).toBeDefined();
            expect(result1.components?.parameters?.globalParams).toBeDefined();

            // Test preserves non-global parameters
            const mixedSpec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/users/{id}': {
                        get: {
                            responses: {},
                            parameters: [
                                { name: 'id', in: 'path', schema: { type: 'string' } },
                                { $ref: '#/components/parameters/_global___query::pretty' },
                                { name: 'include', in: 'query', schema: { type: 'string' } }
                            ]
                        }
                    }
                },
                components: {
                    parameters: {
                        '_global___query::pretty': {
                            name: 'pretty',
                            in: 'query',
                            schema: { type: 'boolean' }
                        }
                    }
                }
            };

            const consolidator2 = new GlobalParameterConsolidator(mixedSpec);
            const result2 = consolidator2.consolidate();
            const getOp = result2.paths!['/users/{id}']!.get!;
            expect(getOp.parameters).toHaveLength(3);
            expect(getOp.parameters!.find(p => (p as OpenAPIV3.ParameterObject).name === 'id')).toBeDefined();
            expect(getOp.parameters!.find(p => (p as OpenAPIV3.ParameterObject).name === 'include')).toBeDefined();
        });

        it('should handle all HTTP methods', () => {
            const spec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/resource': {
                        get: {
                            responses: {},
                            parameters: [{ $ref: '#/components/parameters/_global___query::pretty' }]
                        },
                        post: {
                            responses: {},
                            parameters: [{ $ref: '#/components/parameters/_global___query::pretty' }]
                        },
                        put: {
                            responses: {},
                            parameters: [{ $ref: '#/components/parameters/_global___query::pretty' }]
                        },
                        delete: {
                            responses: {},
                            parameters: [{ $ref: '#/components/parameters/_global___query::pretty' }]
                        }
                    }
                },
                components: {
                    parameters: {
                        '_global___query::pretty': {
                            name: 'pretty',
                            in: 'query',
                            schema: { type: 'boolean' }
                        }
                    }
                }
            };

            const consolidator = new GlobalParameterConsolidator(spec);
            const result = consolidator.consolidate();

            ['get', 'post', 'put', 'delete'].forEach(method => {
                const operation = result.paths!['/resource']![method as keyof OpenAPIV3.PathItemObject];
                expect((operation as OpenAPIV3.OperationObject).parameters).toContainEqual(
                    { $ref: '#/components/parameters/globalParams' }
                );
            });
        });

        it('should not duplicate parameters with same name', () => {
            const spec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {},
                components: {
                    parameters: {
                        '_global___query::pretty': {
                            name: 'pretty',
                            in: 'query',
                            schema: { type: 'boolean' }
                        },
                        '_global___query::pretty_duplicate': {
                            name: 'pretty', // Same name
                            in: 'query',
                            schema: { type: 'boolean' }
                        }
                    }
                }
            };

            const consolidator = new GlobalParameterConsolidator(spec);
            const result = consolidator.consolidate();

            const globalParams = result.components!.schemas!.GlobalParams as OpenAPIV3.SchemaObject;
            const prettyKeys = Object.keys(globalParams.properties || {}).filter(k => k === 'pretty');
            expect(prettyKeys).toHaveLength(1);
        });
    });
});
