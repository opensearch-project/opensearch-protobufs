import { OpenSearchVersionExtractor } from '../src/OpenSearchVersionExtractor';
import { OpenAPIV3 } from 'openapi-types';

describe('OpenSearchVersionExtractor - Basic Tests', () => {
    describe('process', () => {
        it('should process basic spec', () => {
            const spec: any = {
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
                                                $ref: '#/components/schemas/ns___TestSchema'
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
                        'ns___TestSchema': {
                            type: 'object',
                            properties: {
                                oldField: {
                                    type: 'string',
                                    'x-version-added': '2.0.0'
                                },
                                newField: {
                                    type: 'string',
                                    'x-version-added': '3.0.0'
                                }
                            }
                        }
                    }
                }
            };

            const extractor = new OpenSearchVersionExtractor(spec);
            const result = extractor.process('2.5.0');

            // Schema should still exist (keeps ns___ prefix, not renamed by OpenSearchVersionExtractor)
            expect(result.components!.schemas).toBeDefined();
            const schema = result.components!.schemas!['ns___TestSchema'] as OpenAPIV3.SchemaObject;
            expect(schema).toBeDefined();

            // Field added in 2.0.0 should be kept (2.0.0 <= 2.5.0)
            expect(schema.properties).toHaveProperty('oldField');

            // Field added in 3.0.0 should be removed (3.0.0 > 2.5.0)
            expect(schema.properties).not.toHaveProperty('newField');
        });

        it('should handle deprecation', () => {
            const spec: any = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/current': {
                        get: {
                            responses: {
                                '200': {
                                    description: 'Success',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                $ref: '#/components/schemas/CurrentSchema'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '/deprecated': {
                        get: {
                            responses: {
                                '200': {
                                    description: 'Success',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                $ref: '#/components/schemas/DeprecatedSchema'
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
                        'CurrentSchema': {
                            type: 'object',
                            properties: {
                                field: { type: 'string' }
                            }
                        },
                        'DeprecatedSchema': {
                            type: 'object',
                            'x-version-deprecated': '2.0.0',
                            properties: {
                                field: { type: 'string' }
                            }
                        }
                    }
                }
            };

            const extractor = new OpenSearchVersionExtractor(spec);
            const result = extractor.process('2.5.0');

            expect(result.components!.schemas).toHaveProperty('CurrentSchema');

            expect(result.components!.schemas).not.toHaveProperty('DeprecatedSchema');

            // OpenSearchVersionExtractor removes schemas but not paths
            expect(result.paths).toHaveProperty('/current');
        });

        it('should handle version in paths', () => {
            const spec: any = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/old-endpoint': {
                        'x-version-deprecated': '2.0.0',
                        get: {
                            responses: {}
                        }
                    },
                    '/new-endpoint': {
                        get: {
                            responses: {}
                        }
                    }
                }
            };

            const extractor = new OpenSearchVersionExtractor(spec);
            const result = extractor.process('2.5.0');

            expect(result.paths).not.toHaveProperty('/old-endpoint');
            expect(result.paths).toHaveProperty('/new-endpoint');
        });

        it('should handle version in operations', () => {
            const spec: any = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/endpoint': {
                        get: {
                            'x-version-deprecated': '2.0.0',
                            responses: {}
                        },
                        post: {
                            responses: {}
                        }
                    }
                }
            };

            const extractor = new OpenSearchVersionExtractor(spec);
            const result = extractor.process('2.5.0');

            expect(result.paths!['/endpoint']!.get).toBeUndefined();
            expect(result.paths!['/endpoint']!.post).toBeDefined();
        });
    });
});
