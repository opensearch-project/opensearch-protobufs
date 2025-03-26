import _ from "lodash";
import type {OpenAPIV3} from "openapi-types";

/**
 * Sanitizer class:
 * Provides a static method to sanitize a spec by updating $ref strings
 * and renaming schema definitions.
 */
export class Sanitizer {
  public sanitize(spec: any): any {
    this.sanitize_ref(spec);
    this.sanitize_spec(spec as OpenAPIV3.Document);
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

  public sanitize_spec(OpenApiSpec: OpenAPIV3.Document): void {
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
    if (OpenApiSpec.components && OpenApiSpec.components.responses) {
      for (const schemaName in OpenApiSpec.components.responses) {
        const schema = OpenApiSpec.components.responses[schemaName];
        if ("content" in schema && schema.content != undefined) {
          const content = schema.content;
          if ("application/json" in content) {
            const jsonContent = content["application/json"];
            if ("schema" in jsonContent && jsonContent.schema != undefined) {
              const schema = jsonContent.schema as OpenAPIV3.SchemaObject;
              this.sanitize_schema(schema)
            }
          }
        }
      }
    }
    if (OpenApiSpec.components && OpenApiSpec.components.requestBodies) {
      for (const schemaName in OpenApiSpec.components.requestBodies) {
        const schema = OpenApiSpec.components.requestBodies[schemaName];
        if ("content" in schema && schema.content != undefined) {
          const content = schema.content;
          if ("application/json" in content) {
            const jsonContent = content["application/json"];
            if ("schema" in jsonContent && jsonContent.schema != undefined) {
              const schema = jsonContent.schema as OpenAPIV3.SchemaObject;
              this.sanitize_schema(schema)
            }
          }
        }
      }
    }

    if (OpenApiSpec.components && OpenApiSpec.components.parameters) {
      for (const schemaName in OpenApiSpec.components.parameters) {
        if (OpenApiSpec.components.parameters.hasOwnProperty(schemaName)) {
          const schema = OpenApiSpec.components.parameters[schemaName];
          if ("name" in schema && schema.name != undefined) {
            const propName = schema.name
            if (propName.startsWith("_")) {
              const newPropName = "underscore" + propName;
              schema.name = newPropName;
            }
          }
        }
      }
    }
  }

  public sanitize_schema(schema: OpenAPIV3.SchemaObject): void {
    if (schema == undefined) {
        return
    }
    if ("properties" in schema) {
      const properties = schema.properties as Record<string, OpenAPIV3.SchemaObject>
      this.rename_properties_name(properties)
    }
    if("oneOf" in schema && schema.oneOf != undefined) {
      const oneOfs = schema.oneOf
      for (const oneOf of oneOfs) {
        if (oneOf && "properties" in oneOf) {
          const properties = oneOf.properties as Record<string, OpenAPIV3.SchemaObject>
          this.rename_properties_name(properties)
        }
      }
    } else if("allOf" in schema && schema.allOf != undefined) {
      const allOfs = schema.allOf
      for (const allOf of allOfs) {
        if (allOf && "properties" in allOf) {
          const properties = allOf.properties as Record<string, OpenAPIV3.SchemaObject>
          this.rename_properties_name(properties)
        }
      }
    } else if("anyOf" in schema && schema.anyOf != undefined) {
      const anyOfs = schema.anyOf
      for (const anyOf of anyOfs) {
        if (anyOf && "properties" in anyOf) {
          const properties = anyOf.properties as Record<string, OpenAPIV3.SchemaObject>
          this.rename_properties_name(properties)
        }
      }
    }
  }

  public rename_properties_name(properties: Record<string, OpenAPIV3.SchemaObject>) {
    for (var propName in properties) {
      if(propName.startsWith("_")) {
        const newPropName = "underscore" + propName;
        properties[newPropName] = properties[propName];
        delete properties[propName];
      }
    }
  }
}
