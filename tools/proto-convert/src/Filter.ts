import { type OpenAPIV3 } from 'openapi-types'
import _ from "lodash";
import logger from "./utils/logger"
import { getSchemaNames } from "./utils/helper"

/**
 * Recursively traverses a node and for every $ref that starts with "#/components/",
 * enqueues the reference string if it hasn't been visited yet.
 * Skips schemas in the exclusion list.
 */
function traverse_and_enqueue(node: any, queue: string[], visited: Set<string>, excluded: Set<string>): void {
  for (const key in node) {
    var item = node[key]

    if (item?.$ref !== undefined && !visited.has(item.$ref as string) && (item.$ref as string).startsWith('#/components/') || (_.isString(item) && item.startsWith('#/components/'))) {
      var ref = item.$ref as string
      if (ref == null || ref == "" && _.isString(item)){
        ref = item as string;
      }

      // Check exclusion list - if schema is excluded, don't push ref
      const names = getSchemaNames(ref);
      if (names && (excluded.has(names.full) || excluded.has(names.short))) {
        continue;
      }

      queue.push(ref);
      visited.add(ref);
    }
    if (_.isObject(item) || _.isArray(item) || (_.isString(item) && item.startsWith('#/components/'))) {
      traverse_and_enqueue(item, queue, visited, excluded)
    }
  }
}

/**
 * Filters an OpenAPI spec to include only paths matching specified x-operation-groups.
 * Schemas in the excluded set are skipped.
 */
export default class Filter {
  protected input: Record<string, any>
  protected output: Record<string, any>
  protected targetGroups: Set<string>  // operation groups to include
  protected excludedSchemas: Set<string>
  paths: Record<string, Record<string, OpenAPIV3.PathItemObject>> = {} // namespace -> path -> path_item_object

  constructor(input: Record<string, any>, targetGroups: Set<string>, excludedSchemas: Set<string> = new Set()) {
    this.input = input;
    this.targetGroups = targetGroups;
    this.excludedSchemas = excludedSchemas;
    if (this.excludedSchemas.size > 0) {
      logger.info(`Loaded ${this.excludedSchemas.size} excluded schemas: ${Array.from(this.excludedSchemas).join(', ')}`);
    }
    logger.info(`Filtering for operation groups: ${Array.from(targetGroups).join(', ')}`);
    this.output = {
      openapi: '3.1.0',
      info: {},
      paths: {},
      components: {
        parameters: {},
        requestBodies: {},
        responses: {},
        schemas: {}
      }
    }
  }


  filter(): OpenAPIV3.Document {
    this.output.info = this.input.info;

    for (const path in this.input.paths) {
      const pathItem = this.input.paths[path];
      if (!pathItem) continue;

      const filteredPathItem: any = {};
      for (const method of ['get', 'post', 'put', 'delete', 'head'] as const) {
        const operation = pathItem?.[method];
        if (operation && operation['x-operation-group'] && this.targetGroups.has(operation['x-operation-group'])) {
          filteredPathItem[method] = operation;
        }
      }
      if (Object.keys(filteredPathItem).length > 0) {
        this.output.paths[path] = filteredPathItem;
      }
    }

    this.mergeOperationsByGroup(this.output.paths as OpenAPIV3.PathsObject);
    const queue: string[] = [];
    const visited: Set<string> = new Set();

    // collect all components that are referenced by the paths
    traverse_and_enqueue(this.output.paths, queue, visited, this.excludedSchemas);
    while (queue.length > 0) {
      const ref_str = queue.shift();
      if (ref_str == null || ref_str == "") continue;
      const parts = ref_str.split('/');
      if (parts.length !== 4) continue;
      const sub_component = parts[2];
      const key = parts[3];

      if (this.output.components[sub_component as keyof typeof this.output.components] == null) {
        this.output.components[sub_component] = {};
      }
      if (this.output.components[sub_component][key] == null) {
        if (this.input.components != null && this.input.components[sub_component] != null && this.input.components[sub_component][key] != null) {
          this.output.components[sub_component][key] = this.input.components[sub_component][key];
          traverse_and_enqueue(this.output.components[sub_component][key], queue, visited, this.excludedSchemas);
        }
      }
    }
    return this.output as OpenAPIV3.Document;
  }

  /**
   * Merges operations with the same x-operation-group into a single operation.
   * - Validates that requestBody and responses are identical across paths
   * - Merges all parameters from different paths into a union
   */
  mergeOperationsByGroup(paths: OpenAPIV3.PathsObject): void {
    const new_paths: OpenAPIV3.PathsObject = {};

    // Group operations by x-operation-group
    type OperationInfo = {
      path: string;
      method: string;
      operation: OpenAPIV3.OperationObject;
    };
    const operationsByGroup = new Map<string, OperationInfo[]>();

    for (const path in paths) {
      const path_item = paths[path];
      if (!path_item) continue;
      for (const method of Object.keys(path_item) as Array<keyof OpenAPIV3.PathItemObject>) {
        const operation = path_item[method];
        if (operation != null && typeof operation === 'object' && 'x-operation-group' in operation) {
          const group: string = operation['x-operation-group'] as string;
          if (!operationsByGroup.has(group)) {
            operationsByGroup.set(group, []);
          }
          operationsByGroup.get(group)!.push({
            path,
            method,
            operation: operation as OpenAPIV3.OperationObject
          });
        }
      }
    }

    for (const [group, operations] of operationsByGroup.entries()) {
      if (operations.length === 0) continue;

      // 1. Validate requestBody and responses are consistent before merging
      this.validateConsistency(group, operations);

      // 2. Merge parameters from all operations
      const mergedParams = this.mergeParameters(operations);

      // 3. Create merged operation
      const firstOp = operations[0];
      const mergedOperation: OpenAPIV3.OperationObject = {
        ...firstOp.operation,
        operationId: firstOp.operation.operationId?.replace(/\.\d+$/, ''),
        parameters: mergedParams
      };

      if (!new_paths[firstOp.path]) {
        new_paths[firstOp.path] = {};
      }
      (new_paths[firstOp.path] as any)[firstOp.method] = mergedOperation;
    }

    this.output.paths = new_paths;
  }

  private validateConsistency(group: string, operations: { path: string; operation: OpenAPIV3.OperationObject }[]): void {
    // Check requestBody consistency
    const requestBodies = operations
      .map(op => JSON.stringify(op.operation.requestBody))
      .filter(rb => rb !== 'undefined');
    const uniqueRequestBodies = new Set(requestBodies);
    if (uniqueRequestBodies.size > 1) {
      throw new Error(`Operation group '${group}' has inconsistent requestBody across paths: ${operations.map(op => op.path).join(', ')}`);
    }

    // Check responses consistency
    const responses = operations.map(op => JSON.stringify(op.operation.responses));
    const uniqueResponses = new Set(responses);
    if (uniqueResponses.size > 1) {
      throw new Error(`Operation group '${group}' has inconsistent responses across paths: ${operations.map(op => op.path).join(', ')}`);
    }
  }

  private mergeParameters(operations: { operation: OpenAPIV3.OperationObject }[]): (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[] {
    const allParams = new Map<string, OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject>();
    for (const op of operations) {
      const params = op.operation.parameters ?? [];
      for (const param of params) {
        const key = '$ref' in param
          ? param.$ref
          : `${(param as OpenAPIV3.ParameterObject).name}:${(param as OpenAPIV3.ParameterObject).in}`;
        if (!allParams.has(key)) {
          allParams.set(key, param);
        }
      }
    }
    return Array.from(allParams.values());
  }
}
