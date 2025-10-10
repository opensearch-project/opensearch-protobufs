import _ from "lodash";
import type {OpenAPIV3} from "openapi-types";
import {traverse} from "./utils/OpenApiTraverser";
/**
 * Sanitizer class:
 * Provides a static method to sanitize a spec by updating $ref strings
 * and renaming schema definitions.
 */
export class Sanitizer {
  private static readonly META_PREFIX = "x";
  public sanitize(spec: any): any {
    this.sanitize_ref(spec);
    this.sanitize_spec_name(spec as OpenAPIV3.Document);
    return spec;
  }

  sanitize_ref(obj: any): void {
    for (const key in obj) {
      var item = obj[key]

      if (item?.$ref !== undefined) {
        var renamed_ref = this.rename_ref(item.$ref as string)
        if (renamed_ref != item.$ref) {
          item.$ref = renamed_ref
        }
      }
      if (_.isObject(item) || _.isArray(item)) {
        this.sanitize_ref(item)
      }
    }
  }

  rename_model_name(schema_name: string): string {
    if (schema_name.includes('___')) {
      return schema_name.split('___').pop() as string;
    }
    return schema_name;
  }

  rename_ref(ref: string): string {
    if (typeof ref === 'string' && ref.startsWith('#/components/schemas')) {
      const ref_parts = ref.split('/');
      if (ref_parts.length === 4) {
        var model_name = ref_parts[3];
        if (model_name.includes('___') ) {
          model_name = model_name.split('___').pop() as string;
        }
        return ref_parts.slice(0, 3).join('/') + '/' + model_name;
      }
    }
    return ref;
  }

  public sanitize_spec_name(OpenApiSpec: OpenAPIV3.Document): void {
    if (OpenApiSpec.components && OpenApiSpec.components.schemas) {
      for (const schemaName in OpenApiSpec.components.schemas) {
        if (OpenApiSpec.components.schemas.hasOwnProperty(schemaName)) {
          const schema = OpenApiSpec.components.schemas[schemaName];
          this.sanitize_schema(schema as OpenAPIV3.SchemaObject)
        }
        const newModelName = this.rename_model_name(schemaName)
        OpenApiSpec.components.schemas[newModelName] = OpenApiSpec.components.schemas[schemaName];
        delete OpenApiSpec.components.schemas[schemaName]
      }
    }
    traverse(OpenApiSpec, {
      // Run sanitize_schema on all top-level component schemas
      onSchema: (schema, _schemaName) => {
        if (!('$ref' in schema)) {
          this.sanitize_schema(schema);
        }
      },
      onRequestSchema: (schema) => this.sanitize_schema(schema),
      onResponseSchema: (schema) => this.sanitize_schema(schema),
      onParameter: (param, _paramName) => {
        if (!('$ref' in param) && param.name && param.name.startsWith('_')) {
          param.name = `${Sanitizer.META_PREFIX}${param.name}`;
        }
      }
    });
}

  public sanitize_schema(schema: OpenAPIV3.SchemaObject): void {
    if (!schema) return;

    if (schema.properties) {
      this.rename_properties_name(schema.properties as Record<string, OpenAPIV3.SchemaObject>);
    }
    if (schema.required) {
      this.rename_required_name(schema.required);
    }
  }

  public rename_properties_name(properties: Record<string, OpenAPIV3.SchemaObject>) {
    for (var propName in properties) {
      if(propName.startsWith("_")) {
        const newPropName = Sanitizer.META_PREFIX + propName;
        properties[newPropName] = properties[propName];
        delete properties[propName];
      }
    }
  }

  public rename_required_name(requireList: string[]) {
    for (var index in requireList) {
      var propName = requireList[index];
      if(propName.startsWith("_")) {
        requireList[index] = Sanitizer.META_PREFIX + propName;
      }
    }
  }
}
