import { type OpenAPIV3 } from 'openapi-types'
import _ from "lodash";
import Logger from "./utils/logger"
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
 * Filters an OpenAPI spec to include only specified paths and their referenced components.
 * Schemas in the excluded set are skipped.
 */
export default class Filter {
  logger: Logger
  protected _spec: Record<string, any>
  protected targetPaths: string[]
  protected excludedSchemas: Set<string>
  paths: Record<string, Record<string, OpenAPIV3.PathItemObject>> = {} // namespace -> path -> path_item_object

  constructor(logger: Logger, targetPaths: string[], excludedSchemas: Set<string> = new Set()) {
    this.logger = logger
    this.targetPaths = targetPaths;
    this.excludedSchemas = excludedSchemas;
    if (this.excludedSchemas.size > 0) {
      this.logger.info(`Loaded ${this.excludedSchemas.size} excluded schemas: ${Array.from(this.excludedSchemas).join(', ')}`);
    }
    this._spec = {
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


  filter_spec(spec: Record<string, any>): any {
    this._spec.info = spec.info;
    for (const p of this.targetPaths) {
      if (spec.paths[p] === undefined) {
        this.logger.error(`Path not found in spec: ${p}`);
        continue;
      }
      this._spec.paths[p] = spec.paths[p];
    }
    this.filter_by_max_parameters(this._spec.paths as OpenAPIV3.PathsObject);
    const queue: string[] = [];
    const visited: Set<string> = new Set();

    // collect all components that are referenced by the paths
    traverse_and_enqueue(this._spec.paths, queue, visited, this.excludedSchemas);
    while (queue.length > 0) {
      const ref_str = queue.shift();
      if (ref_str == null || ref_str == "") continue;
      const parts = ref_str.split('/');
      if (parts.length !== 4) continue;
      const sub_component = parts[2];
      const key = parts[3];

      if (this._spec.components[sub_component as keyof typeof this._spec.components] == null) {
        this._spec.components[sub_component] = {};
      }
      if (this._spec.components[sub_component][key] == null) {
        if (spec.components != null && spec.components[sub_component] != null && spec.components[sub_component][key] != null) {
          this._spec.components[sub_component][key] = spec.components[sub_component][key];
          traverse_and_enqueue(this._spec.components[sub_component][key], queue, visited, this.excludedSchemas);
        }
      }
    }
    return this._spec;
  }

  filter_by_max_parameters(paths: OpenAPIV3.PathsObject): void {
    const new_paths: OpenAPIV3.PathsObject = {};
    let operation_map = new Map<string, Array<Record<string, OpenAPIV3.PathItemObject>>>();
    for (const path in paths) {
      const path_item = paths[path];
      if (!path_item) continue;
      for (const method of Object.keys(path_item) as Array<keyof OpenAPIV3.PathItemObject>) {
        const operation = path_item[method];
        if (operation != null && typeof operation === 'object' && 'x-operation-group' in operation) {
          const group: string = operation['x-operation-group'] as string;
          if (!operation_map.get(group)) {
            operation_map.set(group, []);
          }
          const group_map: Record<string, OpenAPIV3.PathItemObject> = {
            [path]: {
              [method]: operation as OpenAPIV3.OperationObject,
            },
          };
          operation_map.get(group)?.push(group_map);
        }
      }
    }


    for (const operations of operation_map.values()) {
      let max_parameters = -1;
      let max_path_item: OpenAPIV3.PathItemObject | null = null;
      let max_path = '';
      for (const op of operations) {
        for (const [path, path_item] of Object.entries(op)) {
          for (const operation of Object.values(path_item)) {
            if (operation != null && typeof operation === 'object' && Array.isArray((operation as OpenAPIV3.OperationObject).parameters)) {
              const param_count = (operation as OpenAPIV3.OperationObject).parameters?.length??0;
              if (param_count > max_parameters) {
                max_parameters = param_count;
                max_path = path;
                max_path_item = path_item;
              }
            }
          }
        }
      }
      if ((max_path_item?.get?.operationId) != null) {
        max_path_item.get.operationId = max_path_item.get.operationId.replace(/\.\d+$/, '');
        new_paths[max_path] = { ...new_paths[max_path], get: max_path_item.get };
      } else if ((max_path_item?.post?.operationId != null))  {
        max_path_item.post.operationId = max_path_item.post.operationId.replace(/\.\d+$/, '');
        new_paths[max_path] = { ...new_paths[max_path], post: max_path_item.post };
      } else if ((max_path_item?.put?.operationId != null)) {
        max_path_item.put.operationId = max_path_item.put.operationId.replace(/\.\d+$/, '');
        new_paths[max_path] = { ...new_paths[max_path], put: max_path_item.put };
      } else if ((max_path_item?.delete?.operationId != null)) {
        max_path_item.delete.operationId = max_path_item.delete.operationId.replace(/\.\d+$/, '');
        new_paths[max_path] = { ...new_paths[max_path], delete: max_path_item.delete };
      } else if ((max_path_item?.head?.operationId != null)) {
        max_path_item.head.operationId = max_path_item.head.operationId.replace(/\.\d+$/, '');
        new_paths[max_path] = { ...new_paths[max_path], head: max_path_item.head };
      }
    }
    this._spec.paths = new_paths;
  }
}
