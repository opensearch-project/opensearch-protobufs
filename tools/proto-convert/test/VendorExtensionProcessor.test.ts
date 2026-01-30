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
        it('should apply type mapping for int32', () => {
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
                                count: {
                                    type: 'number',
                                    'x-protobuf-type': 'int32'
                                }
                            }
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const schema = result.components!.schemas!['TestSchema'] as any;
            expect(schema.properties.count.type).toBe('integer');
            expect(schema.properties.count.format).toBe('int32');
            expect(schema.properties.count['x-protobuf-type']).toBeUndefined();
        });

        it('should apply type mapping for int64', () => {
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
                            'x-protobuf-type': 'int64'
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const schema = result.components!.schemas!['TestSchema'] as any;
            expect(schema.type).toBe('integer');
            expect(schema.format).toBe('int64');
        });


        it('should use custom type when not in mapping', () => {
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
                            'x-protobuf-type': 'CustomType'
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const schema = result.components!.schemas!['TestSchema'] as any;
            expect(schema.type).toBe('CustomType');
            expect(schema.format).toBeUndefined();
        });

        it('should apply type override in request bodies', () => {
            const spec: any = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/test': {
                        post: {
                            requestBody: {
                                $ref: '#/components/requestBodies/TestRequest'
                            },
                            responses: { '200': { description: 'Success' } }
                        },
                        get: {
                            responses: {
                                '200': {
                                    description: 'Success',
                                    content: {
                                        'application/json': {
                                            schema: { $ref: '#/components/schemas/RequestSchema' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    requestBodies: {
                        'TestRequest': {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            field: { 'x-protobuf-type': 'int64' }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    schemas: {
                        'RequestSchema': {
                            type: 'object',
                            properties: {
                                count: { 'x-protobuf-type': 'int32' }
                            }
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const requestBody = result.components!.requestBodies!['TestRequest'] as any;
            const requestSchema = requestBody.content['application/json'].schema;
            expect(requestSchema.properties.field.type).toBe('integer');
            expect(requestSchema.properties.field.format).toBe('int64');

            const schema = result.components!.schemas!['RequestSchema'] as any;
            expect(schema.properties.count.type).toBe('integer');
            expect(schema.properties.count.format).toBe('int32');
        });

        it('should apply name override in responses', () => {
            const spec: any = {
                openapi: '3.1.0',
                info: { title: 'Test API', version: '1.0.0' },
                paths: {
                    '/test': {
                        get: {
                            responses: {
                                '200': { $ref: '#/components/responses/SuccessResponse' },
                                '201': {
                                    description: 'Created',
                                    content: {
                                        'application/json': {
                                            schema: { $ref: '#/components/schemas/ResponseSchema' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                components: {
                    responses: {
                        'SuccessResponse': {
                            description: 'Success',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            oldName: {
                                                type: 'string',
                                                'x-protobuf-name': 'newName'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    schemas: {
                        'ResponseSchema': {
                            type: 'object',
                            properties: {
                                result: { type: 'string' }
                            }
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const response = result.components!.responses!['SuccessResponse'] as any;
            const schema = response.content['application/json'].schema;
            expect(schema.properties).not.toHaveProperty('oldName');
            expect(schema.properties).toHaveProperty('newName');
        });

        it('should not rename parameter when x-protobuf-name equals current name', () => {
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
                            name: 'sameName',
                            in: 'query',
                            schema: { type: 'string' },
                            'x-protobuf-name': 'sameName'
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const param = result.components!.parameters!['testParam'] as any;
            expect(param.name).toBe('sameName');
            // Extension is NOT removed when name is same (no change needed)
            expect(param['x-protobuf-name']).toBe('sameName');
        });

        it('should handle composed schema without x-protobuf-name', () => {
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
                                { type: 'string' },
                                { type: 'number' }
                            ]
                        }
                    }
                }
            };

            const processor = new VendorExtensionProcessor(spec);
            const result = processor.process();

            const schema = result.components!.schemas!['TestSchema'] as any;
            expect(schema.oneOf).toHaveLength(2);
            expect(schema.oneOf[0].title).toBeUndefined();
        });
    });
});
