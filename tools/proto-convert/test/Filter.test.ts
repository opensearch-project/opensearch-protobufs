/**
 * Tests for the Filter module.
 */

import Filter from '../src/Filter';
import { OpenAPIV3 } from 'openapi-types';

describe('Filter', () => {
  const createSpec = (paths: Record<string, any>, components?: Record<string, any>): Record<string, any> => ({
    openapi: '3.1.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths,
    components: components ?? { schemas: {}, parameters: {}, responses: {} }
  });

  const createOperation = (
    group: string,
    operationId: string,
    params?: any[],
    requestBody?: any,
    responses?: any
  ): OpenAPIV3.OperationObject => ({
    operationId,
    'x-operation-group': group,
    parameters: params,
    requestBody,
    responses: responses ?? { '200': { description: 'OK' } }
  } as any);

  describe('path filtering', () => {
    it('should include all operations when targetGroups is null', () => {
      const spec = createSpec({
        '/pets': {
          get: createOperation('pets.list', 'listPets'),
          post: createOperation('pets.create', 'createPet')
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([['/pets', null]]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      expect(result.paths['/pets']).toBeDefined();
      expect((result.paths['/pets'] as any).get).toBeDefined();
      expect((result.paths['/pets'] as any).post).toBeDefined();
    });

    it('should filter operations by x-operation-group', () => {
      const spec = createSpec({
        '/pets': {
          get: createOperation('pets.list', 'listPets'),
          post: createOperation('pets.create', 'createPet'),
          delete: createOperation('pets.delete', 'deletePet')
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([
        ['/pets', new Set(['pets.list', 'pets.create'])]
      ]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      expect((result.paths['/pets'] as any).get).toBeDefined();
      expect((result.paths['/pets'] as any).post).toBeDefined();
      expect((result.paths['/pets'] as any).delete).toBeUndefined();
    });

    it('should skip paths not in targetPathsMap', () => {
      const spec = createSpec({
        '/pets': { get: createOperation('pets.list', 'listPets') },
        '/users': { get: createOperation('users.list', 'listUsers') }
      });

      const pathsMap = new Map<string, Set<string> | null>([['/pets', null]]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      expect(result.paths['/pets']).toBeDefined();
      expect(result.paths['/users']).toBeUndefined();
    });

    it('should handle path not found in spec gracefully', () => {
      const spec = createSpec({
        '/pets': { get: createOperation('pets.list', 'listPets') }
      });

      const pathsMap = new Map<string, Set<string> | null>([
        ['/pets', null],
        ['/nonexistent', null]
      ]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      expect(result.paths['/pets']).toBeDefined();
      expect(result.paths['/nonexistent']).toBeUndefined();
    });
  });

  describe('mergeOperationsByGroup', () => {
    it('should merge parameters from multiple paths with same operation group', () => {
      const spec = createSpec({
        '/pets': {
          get: createOperation('pets.list', 'listPets.1', [
            { name: 'limit', in: 'query', schema: { type: 'integer' } }
          ])
        },
        '/pets/{petId}': {
          get: createOperation('pets.list', 'listPets.2', [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'petId', in: 'path', schema: { type: 'string' } }
          ])
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([
        ['/pets', null],
        ['/pets/{petId}', null]
      ]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      // Should merge to first path with merged parameters
      const operation = (result.paths['/pets'] as any)?.get;
      expect(operation).toBeDefined();
      expect(operation.parameters).toHaveLength(2);
      expect(operation.parameters.map((p: any) => p.name)).toContain('limit');
      expect(operation.parameters.map((p: any) => p.name)).toContain('petId');
    });

    it('should deduplicate parameters by name:in key', () => {
      const spec = createSpec({
        '/pets': {
          get: createOperation('pets.list', 'listPets.1', [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } }
          ])
        },
        '/pets/{id}': {
          get: createOperation('pets.list', 'listPets.2', [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'id', in: 'path', schema: { type: 'string' } }
          ])
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([
        ['/pets', null],
        ['/pets/{id}', null]
      ]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      const operation = (result.paths['/pets'] as any)?.get;
      expect(operation.parameters).toHaveLength(3); // limit (deduped), offset, id
    });

    it('should deduplicate parameters by $ref', () => {
      const spec = createSpec({
        '/pets': {
          get: createOperation('pets.list', 'listPets.1', [
            { $ref: '#/components/parameters/limit' }
          ])
        },
        '/pets/{id}': {
          get: createOperation('pets.list', 'listPets.2', [
            { $ref: '#/components/parameters/limit' },
            { $ref: '#/components/parameters/id' }
          ])
        }
      }, {
        parameters: {
          limit: { name: 'limit', in: 'query', schema: { type: 'integer' } },
          id: { name: 'id', in: 'path', schema: { type: 'string' } }
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([
        ['/pets', null],
        ['/pets/{id}', null]
      ]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      const operation = (result.paths['/pets'] as any)?.get;
      expect(operation.parameters).toHaveLength(2); // limit (deduped), id
    });

    it('should strip trailing number from operationId', () => {
      const spec = createSpec({
        '/pets': {
          get: createOperation('pets.list', 'listPets.1', [])
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([['/pets', null]]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      const operation = (result.paths['/pets'] as any)?.get;
      expect(operation.operationId).toBe('listPets');
    });
  });

  describe('validateConsistency', () => {
    it('should throw error when requestBody differs across paths', () => {
      const spec = createSpec({
        '/pets': {
          post: createOperation('pets.create', 'createPet.1', [],
            { content: { 'application/json': { schema: { type: 'object' } } } })
        },
        '/pets/{id}': {
          post: createOperation('pets.create', 'createPet.2', [],
            { content: { 'application/xml': { schema: { type: 'string' } } } })
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([
        ['/pets', null],
        ['/pets/{id}', null]
      ]);
      const filter = new Filter(spec, pathsMap);

      expect(() => filter.filter()).toThrow(/inconsistent requestBody/);
    });

    it('should throw error when responses differ across paths', () => {
      const spec = createSpec({
        '/pets': {
          get: createOperation('pets.list', 'listPets.1', [], undefined,
            { '200': { description: 'Success' } })
        },
        '/pets/{id}': {
          get: createOperation('pets.list', 'listPets.2', [], undefined,
            { '200': { description: 'Different' } })
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([
        ['/pets', null],
        ['/pets/{id}', null]
      ]);
      const filter = new Filter(spec, pathsMap);

      expect(() => filter.filter()).toThrow(/inconsistent responses/);
    });

    it('should not throw when requestBody and responses are identical', () => {
      const requestBody = { content: { 'application/json': { schema: { type: 'object' } } } };
      const responses = { '200': { description: 'OK' } };

      const spec = createSpec({
        '/pets': {
          post: createOperation('pets.create', 'createPet.1', [], requestBody, responses)
        },
        '/pets/{id}': {
          post: createOperation('pets.create', 'createPet.2', [], requestBody, responses)
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([
        ['/pets', null],
        ['/pets/{id}', null]
      ]);
      const filter = new Filter(spec, pathsMap);

      expect(() => filter.filter()).not.toThrow();
    });

    it('should allow operations without requestBody', () => {
      const spec = createSpec({
        '/pets': {
          get: createOperation('pets.list', 'listPets.1', [])
        },
        '/pets/{id}': {
          get: createOperation('pets.list', 'listPets.2', [])
        }
      });

      const pathsMap = new Map<string, Set<string> | null>([
        ['/pets', null],
        ['/pets/{id}', null]
      ]);
      const filter = new Filter(spec, pathsMap);

      expect(() => filter.filter()).not.toThrow();
    });
  });

  describe('excluded schemas', () => {
    it('should not include excluded schemas in output', () => {
      const spec = createSpec({
        '/pets': {
          get: createOperation('pets.list', 'listPets', [], undefined, {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PetList' }
                }
              }
            }
          })
        }
      }, {
        schemas: {
          PetList: {
            type: 'object',
            properties: {
              items: { $ref: '#/components/schemas/Pet' },
              excluded: { $ref: '#/components/schemas/ExcludedSchema' }
            }
          },
          Pet: { type: 'object' },
          ExcludedSchema: { type: 'object' }
        },
        responses: {},
        parameters: {}
      });

      const pathsMap = new Map<string, Set<string> | null>([['/pets', null]]);
      const excludedSchemas = new Set(['ExcludedSchema']);
      const filter = new Filter(spec, pathsMap, excludedSchemas);
      const result = filter.filter();

      expect(result.components?.schemas?.['PetList']).toBeDefined();
      expect(result.components?.schemas?.['Pet']).toBeDefined();
      expect(result.components?.schemas?.['ExcludedSchema']).toBeUndefined();
    });
  });

  describe('component collection', () => {
    it('should collect referenced components from paths', () => {
      const spec = createSpec({
        '/pets': {
          get: {
            operationId: 'listPets',
            'x-operation-group': 'pets.list',
            parameters: [{ $ref: '#/components/parameters/limit' }],
            responses: {
              '200': { $ref: '#/components/responses/PetListResponse' }
            }
          }
        }
      }, {
        parameters: {
          limit: { name: 'limit', in: 'query', schema: { type: 'integer' } }
        },
        responses: {
          PetListResponse: { description: 'A list of pets' }
        },
        schemas: {}
      });

      const pathsMap = new Map<string, Set<string> | null>([['/pets', null]]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      expect(result.components?.parameters?.['limit']).toBeDefined();
      expect(result.components?.responses?.['PetListResponse']).toBeDefined();
    });

    it('should recursively collect nested component references', () => {
      const spec = createSpec({
        '/pets': {
          get: {
            operationId: 'listPets',
            'x-operation-group': 'pets.list',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/PetList' }
                  }
                }
              }
            }
          }
        }
      }, {
        schemas: {
          PetList: {
            type: 'array',
            items: { $ref: '#/components/schemas/Pet' }
          },
          Pet: {
            type: 'object',
            properties: {
              owner: { $ref: '#/components/schemas/Owner' }
            }
          },
          Owner: { type: 'object', properties: { name: { type: 'string' } } },
          UnusedSchema: { type: 'object' }
        },
        parameters: {},
        responses: {}
      });

      const pathsMap = new Map<string, Set<string> | null>([['/pets', null]]);
      const filter = new Filter(spec, pathsMap);
      const result = filter.filter();

      expect(result.components?.schemas?.['PetList']).toBeDefined();
      expect(result.components?.schemas?.['Pet']).toBeDefined();
      expect(result.components?.schemas?.['Owner']).toBeDefined();
      expect(result.components?.schemas?.['UnusedSchema']).toBeUndefined();
    });
  });
});
