import {mkdirSync, writeFileSync, readFileSync} from 'fs'
import {parse, visit, Document} from 'yaml'
import {dirname} from "path";
import {OpenAPIV3} from "openapi-types";
import _ from 'lodash';

/**
 * Extracts schema names from a $ref string.
 */
export function getSchemaNames(ref: string): { full: string; short: string } | null {
  if (!ref.startsWith('#/components/schemas/')) return null;
  const full = ref.split('/').pop() || '';
  const short = full.includes('___') ? full.split('___').pop() || full : full;
  return { full, short };
}

export function read_yaml<T = Record<string, any>> (file_path: string, exclude_schema: boolean = false): T {
    const doc = parse(readFileSync(file_path, 'utf8'))
    if (typeof doc === 'object' && exclude_schema) delete doc.$schema
    return doc
}

export function write_yaml (file_path: string, content: any): void {
    const doc = new Document(content, null, { aliasDuplicateObjects: false })

    visit(doc, {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Scalar(_, node) {
            if (typeof node.value === 'string') {
                const value = node.value.toLowerCase();
                // Ensure "human" boolean string values are quoted as old YAML parsers might coerce them to boolean true/false
                if (value === 'no' || value === 'yes' || value === 'n' || value === 'y' || value === 'off' || value === 'on') {
                    node.type = 'QUOTE_SINGLE'
                }
            }
        }
    })

    write_text(file_path, doc.toString({
        lineWidth: 0,
        singleQuote: true
    }))
}

export function ensure_parent_dir (file_path: string): void {
    mkdirSync(dirname(file_path), { recursive: true })
}

export function write_text (file_path: string, text: string): void {
    ensure_parent_dir(file_path)
    writeFileSync(file_path, text)
}

export function compressMultipleUnderscores(str: string): string {
    return str.replace(/_+/g, '_');
}

export function resolveObj(
    obj: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined,
    root: OpenAPIV3.Document
): OpenAPIV3.SchemaObject | undefined {
    if (!obj) return undefined;

    if ("$ref" in obj) {
        return resolveRef(obj.$ref, root);
    }
    return obj as OpenAPIV3.SchemaObject;
}

export function resolveRef (ref: string, root: Record<string, any>): Record<string, any> | undefined {
    const paths = ref.replace('#/', '').split('/')
    for (const p of paths) {
        root = root[p]
        if (root === undefined) break
    }
    return root
}

export function isPrimitiveType(schema: OpenAPIV3.SchemaObject): boolean {
    if (schema.type === undefined || schema.type === "array") {
        return false;
    }

    const primitiveTypes: Array<OpenAPIV3.NonArraySchemaObjectType> = [
        'string',
        'number',
        'integer',
        'boolean'
    ];

    return primitiveTypes.includes(schema.type);
}

export function isEmptyObjectSchema(schema: OpenAPIV3.SchemaObject): boolean {
    return (
        schema.type === 'object' &&
        !schema.properties &&
        !schema.allOf &&
        !schema.anyOf &&
        !schema.oneOf &&
        !('$ref' in schema)
    );
}

export function isReferenceObject(schema: any): schema is OpenAPIV3.ReferenceObject {
    return schema !== null && typeof schema === 'object' && '$ref' in schema;
}

/**
 * Recursively delete all items matching the given condition
 * This includes removing them from their parent collections and cleaning up empty arrays
 */
export function deleteMatchingKeys(obj: any, condition: (item: any) => boolean): void {
    for (const key in obj) {
        const item = obj[key];

        if (_.isObject(item)) {
            if (condition(item)) {
                delete obj[key];
            } else {
                deleteMatchingKeys(item, condition);
                if (_.isArray(item)) {
                    obj[key] = _.compact(item);
                }
            }
        }
    }
}

/**
 * Find all $ref references in the spec, including nested references.
 */
export function find_refs (current: Record<string, any>, root?: Record<string, any>, call_stack: string[] = []): Set<string> {
    var results = new Set<string>()

    if (root === undefined) {
        root = current
        current = current.paths
    }

    if (current?.$ref != null) {
        const ref = current.$ref as string
        results.add(ref)
        const ref_node = resolveRef(ref, root as OpenAPIV3.Document)
        if (ref_node !== undefined && !call_stack.includes(ref)) {
            call_stack.push(ref)
            find_refs(ref_node, root, call_stack).forEach((ref) => results.add(ref))
        }
    }

    if (_.isObject(current)) {
        _.forEach(current, (v) => {
            find_refs(v as Record<string, any>, root, call_stack).forEach((ref) => results.add(ref));
        })
    }

    return results
}

/**
 * Remove unused component definitions and broken $ref entries
 */
export function remove_unused(spec: OpenAPIV3.Document): void {
    if (spec === undefined) return;

    const references = find_refs(spec);

    const componentTypes = ['parameters', 'requestBodies', 'responses', 'schemas'];
    for (const componentType of componentTypes) {
        const components = spec.components?.[componentType as keyof OpenAPIV3.ComponentsObject];
        if (!components || !_.isObject(components)) continue;

        for (const key of Object.keys(components)) {
            if (!references.has(`#/components/${componentType}/${key}`)) {
                delete components[key];
            }
        }
    }

    const remaining = _.flatMap(
        ['schemas', 'parameters', 'responses', 'requestBodies'],
        (key) => _.keys((spec?.components as any)?.[key]).map((ref) => `#/components/${key}/${ref}`)
    );

    // Remove properties where $ref is broken (direct or nested in additionalProperties)
    deleteMatchingKeys(spec, (obj: any) => {
        // Case 1: Direct broken $ref
        if (obj.$ref !== undefined && !_.includes(remaining, obj.$ref)) {
            return true;
        }
        // Case 2: additionalProperties.$ref is broken
        if (obj.additionalProperties?.$ref !== undefined &&
            !_.includes(remaining, obj.additionalProperties.$ref)) {
            return true;
        }
        // Case 3: additionalProperties.items.$ref is broken (for array types)
        if (obj.additionalProperties?.items?.$ref !== undefined &&
            !_.includes(remaining, obj.additionalProperties.items.$ref)) {
            return true;
        }
        // Case 4: Object has empty properties (properties: {})
        if (obj.properties && _.isObject(obj.properties) && _.isEmpty(obj.properties) && obj.type !== 'object') {
            return true;
        }
        return false;
    });
}

/**
 * Checks if a schema object is a simple $ref with no other properties.
 */
export function is_simple_ref(schema: any): boolean {
    if (!schema || typeof schema !== 'object') {
        return false;
    }
    const keys = Object.keys(schema);
    return keys.length === 1 && '$ref' in schema;
}

/**
 * Parse x-operation-groups config from spec-filter.yaml
 * @param groups - Array of operation group names
 * @returns Set of operation group names
 */
export function parseOperationGroupsConfig(groups: string[] | undefined): Set<string> {
    if (!groups || groups.length === 0) {
        return new Set(['search']); // default
    }
    return new Set(groups);
}
