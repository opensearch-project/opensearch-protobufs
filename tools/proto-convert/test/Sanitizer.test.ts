import { Sanitizer } from '../src/Sanitizer';
import { OpenAPIV3 } from 'openapi-types';

describe('Sanitizer - Basic Tests', () => {
    describe('sanitize', () => {
        it('should sanitize basic spec successfully', () => {
            const spec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/users': {
                        get: {
                            responses: {
                                '200': {
                                    description: 'Success',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                $ref: '#/components/schemas/namespace___User'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    schemas: {
                        'namespace___User': {
                            type: 'object',
                            properties: {
                                '_id': { type: 'string' },
                                'name': { type: 'string' }
                            },
                            required: ['_id', 'name']
                        }
                    }
                }
            };

            const sanitizer = new Sanitizer(spec);
            const result = sanitizer.sanitize();

            // Schema should be renamed from namespace___User to User
            expect(result.components!.schemas).toHaveProperty('User');
            expect(result.components!.schemas).not.toHaveProperty('namespace___User');

            // Properties starting with _ should be renamed to x_
            const schema = result.components!.schemas!.User as OpenAPIV3.SchemaObject;
            expect(schema.properties).toHaveProperty('x_id');
            expect(schema.properties).not.toHaveProperty('_id');
            expect(schema.properties).toHaveProperty('name');

            // Required array should be updated
            expect(schema.required).toContain('x_id');
            expect(schema.required).not.toContain('_id');
            expect(schema.required).toContain('name');

            // $ref in path should be updated too
            const response = result.paths!['/users']!.get!.responses!['200'] as OpenAPIV3.ResponseObject;
            const responseSchema = response.content!['application/json'].schema as OpenAPIV3.ReferenceObject;
            expect(responseSchema.$ref).toBe('#/components/schemas/User');
        });

        it('should handle parameters in paths', () => {
            const spec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/search': {
                        get: {
                            parameters: [
                                {
                                    name: '_source',
                                    in: 'query',
                                    schema: { type: 'string' }
                                },
                                {
                                    name: 'query',
                                    in: 'query',
                                    schema: { type: 'string' }
                                }
                            ],
                            responses: {}
                        }
                    }
                },
                components: {}
            };

            const sanitizer = new Sanitizer(spec);
            const result = sanitizer.sanitize();

            // Sanitizer should process the spec without errors
            const params = result.paths!['/search']!.get!.parameters as OpenAPIV3.ParameterObject[];
            expect(params).toBeDefined();
            expect(params).toHaveLength(2);

            // Parameters exist and spec is valid
            expect(params.some(p => p.in === 'query')).toBe(true);
        });

        it('should update $ref strings', () => {
            const spec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/users': {
                        get: {
                            responses: {
                                '200': {
                                    description: 'Success',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                $ref: '#/components/schemas/ns___User'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    schemas: {
                        'ns___User': {
                            type: 'object',
                            properties: {
                                profile: {
                                    $ref: '#/components/schemas/ns___Profile'
                                }
                            }
                        },
                        'ns___Profile': {
                            type: 'object',
                            properties: {
                                bio: { type: 'string' }
                            }
                        }
                    }
                }
            };

            const sanitizer = new Sanitizer(spec);
            const result = sanitizer.sanitize();

            // Schema names should be renamed
            expect(result.components!.schemas).toHaveProperty('User');
            expect(result.components!.schemas).toHaveProperty('Profile');

            // $ref in schema property should be updated
            const userSchema = result.components!.schemas!.User as OpenAPIV3.SchemaObject;
            const profileProp = userSchema.properties!.profile as OpenAPIV3.ReferenceObject;
            expect(profileProp.$ref).toBe('#/components/schemas/Profile');
        });

        it('should handle empty spec', () => {
            const spec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {}
            };

            const sanitizer = new Sanitizer(spec);
            expect(() => sanitizer.sanitize()).not.toThrow();
        });

        it('should rename model names with multiple triple underscores', () => {
            const spec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/test': {
                        get: {
                            responses: {
                                '200': {
                                    description: 'Success',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                $ref: '#/components/schemas/a___b___c___FinalName'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    schemas: {
                        'a___b___c___FinalName': {
                            type: 'object',
                            properties: {
                                field: { type: 'string' }
                            }
                        }
                    }
                }
            };

            const sanitizer = new Sanitizer(spec);
            const result = sanitizer.sanitize();

            // Should extract only the last segment after triple underscores
            expect(result.components!.schemas).toHaveProperty('FinalName');
            expect(result.components!.schemas).not.toHaveProperty('a___b___c___FinalName');

            // $ref should be updated
            const response = result.paths!['/test']!.get!.responses!['200'] as OpenAPIV3.ResponseObject;
            const responseSchema = response.content!['application/json'].schema as OpenAPIV3.ReferenceObject;
            expect(responseSchema.$ref).toBe('#/components/schemas/FinalName');
        });
    });
});
