import { VendorExtensionProcessor } from '../src/VendorExtensionProcessor';
import { OpenAPIV3 } from 'openapi-types';

describe('VendorExtensionProcessor - Basic Tests', () => {
    describe('process', () => {
        it('should remove schemas with x-protobuf-excluded', () => {
            const spec: any = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/included': {
                        get: {
                            responses: {
                                '200': {
                                    description: 'Success',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                $ref: '#/components/schemas/IncludedSchema'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '/excluded': {
                        get: {
                            responses: {
                                '200': {
                                    description: 'Success',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                $ref: '#/components/schemas/ExcludedSchema'
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
                        'IncludedSchema': {
                            type: 'object',
                            properties: {
                                field: { type: 'string' }
                            }
                        },
                        'ExcludedSchema': {
                            'x-protobuf-excluded': true,
                            type: 'object',
                            properties: {
                                field: { type: 'string' }
                            }
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            // Included schema should remain
            expect(result.components!.schemas).toHaveProperty('IncludedSchema');

            // Excluded schema should be removed
            expect(result.components!.schemas).not.toHaveProperty('ExcludedSchema');
        });

        it('should process vendor extensions', () => {
            // Basic test to ensure processor runs without errors
            const spec: any = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {},
                components: {
                    schemas: {
                        'TestSchema': {
                            type: 'object',
                            properties: {
                                field: { type: 'string' }
                            }
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            expect(result).toBeDefined();
            expect(result.openapi).toBe('3.1.0');
        });

        it('should handle empty spec', () => {
            const spec: OpenAPIV3.Document = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {}
            };

            const processor = new VendorExtensionProcessor(spec);
            expect(() => processor.process()).not.toThrow();
        });

        it('should handle spec without vendor extensions', () => {
            const spec: any = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {},
                components: {
                    schemas: {
                        'NormalSchema': {
                            type: 'object',
                            properties: {
                                field: { type: 'string' }
                            }
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            expect(result.components).toBeDefined();
        });

        it('should exclude schemas referenced by $ref with x-protobuf-excluded', () => {
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
                                                type: 'object',
                                                properties: {
                                                    data: { $ref: '#/components/schemas/ExcludedViaRef' }
                                                }
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
                        'ExcludedViaRef': {
                            'x-protobuf-excluded': true,
                            type: 'string'
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            // The property with $ref to excluded schema should be removed
            const responseSchema = result.paths!['/test']!.get!.responses!['200'] as any;
            expect(responseSchema.content['application/json'].schema.properties).not.toHaveProperty('data');
        });
    });

    describe('x-protobuf-name extension', () => {
        it('should rename component parameter with x-protobuf-name', () => {
            const spec: any = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/test': {
                        get: {
                            parameters: [
                                { $ref: '#/components/parameters/testParam' }
                            ],
                            responses: { '200': { description: 'Success' } }
                        }
                    }
                },
                components: {
                    parameters: {
                        'testParam': {
                            name: 'oldParamName',
                            in: 'query',
                            schema: { type: 'string' },
                            'x-protobuf-name': 'newParamName'
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            // Check component parameter was renamed
            const componentParam = result.components!.parameters!['testParam'] as any;
            expect(componentParam.name).toBe('newParamName');
            expect(componentParam['x-protobuf-name']).toBeUndefined();
        });

        it('should rename property with x-protobuf-name', () => {
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
                                            schema: { $ref: '#/components/schemas/TestSchema' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    schemas: {
                        'TestSchema': {
                            type: 'object',
                            properties: {
                                'old_field': {
                                    type: 'string',
                                    'x-protobuf-name': 'new_field'
                                }
                            }
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const schema = result.components!.schemas!['TestSchema'] as any;
            expect(schema.properties).not.toHaveProperty('old_field');
            expect(schema.properties).toHaveProperty('new_field');
            expect(schema.properties.new_field['x-protobuf-name']).toBeUndefined();
        });

        it('should set title for composed schemas (oneOf) with x-protobuf-name', () => {
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
                                            schema: { $ref: '#/components/schemas/TestSchema' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    schemas: {
                        'TestSchema': {
                            oneOf: [
                                {
                                    type: 'string',
                                    'x-protobuf-name': 'StringVariant'
                                },
                                {
                                    type: 'number',
                                    'x-protobuf-name': 'NumberVariant'
                                }
                            ]
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const schema = result.components!.schemas!['TestSchema'] as any;
            expect(schema.oneOf[0].title).toBe('StringVariant');
            expect(schema.oneOf[0]['x-protobuf-name']).toBeUndefined();
            expect(schema.oneOf[1].title).toBe('NumberVariant');
            expect(schema.oneOf[1]['x-protobuf-name']).toBeUndefined();
        });
    });

    describe('x-protobuf-type extension', () => {
        it('should simplify complex schema with oneOf to single type', () => {
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
                                            schema: { $ref: '#/components/schemas/StringifiedInteger' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    schemas: {
                        'StringifiedInteger': {
                            description: 'Integer that may be represented as string',
                            oneOf: [
                                { type: 'integer' },
                                { type: 'string', pattern: '^[+-]?\\d+$' }
                            ],
                            'x-protobuf-type': 'int32'
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const schema = result.components!.schemas!['StringifiedInteger'] as any;
            // oneOf should be removed
            expect(schema.oneOf).toBeUndefined();
            // type should be set to x-protobuf-type value
            expect(schema.type).toBe('int32');
            // x-protobuf-type should be preserved for Mustache template
            expect(schema['x-protobuf-type']).toBe('int32');
            // description should be preserved
            expect(schema.description).toBeDefined();
        });

        it('should preserve x-protobuf-type and set type', () => {
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
                                            schema: { $ref: '#/components/schemas/TestSchema' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    schemas: {
                        'TestSchema': {
                            type: 'object',
                            properties: {
                                data: { 'x-protobuf-type': 'bytes' }
                            }
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const schema = result.components!.schemas!['TestSchema'] as any;
            expect(schema.properties.data.type).toBe('bytes');
            expect(schema.properties.data['x-protobuf-type']).toBe('bytes');
        });

        it('should clear structural properties when applying type override', () => {
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
                                            schema: { $ref: '#/components/schemas/ComplexSchema' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    schemas: {
                        'ComplexSchema': {
                            allOf: [
                                { type: 'object' },
                                { properties: { field: { type: 'string' } } }
                            ],
                            'x-protobuf-type': 'string'
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const schema = result.components!.schemas!['ComplexSchema'] as any;
            // Structural properties should be removed
            expect(schema.allOf).toBeUndefined();
            expect(schema.properties).toBeUndefined();
            // Type should be simplified
            expect(schema.type).toBe('string');
            expect(schema['x-protobuf-type']).toBe('string');
        });
    });
});
