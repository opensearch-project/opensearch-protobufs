/**
 * Parser module: Load .proto files and convert to internal types.
 */

import { readFileSync } from 'fs';
import { parse, Field, Enum, Type, Namespace, NamespaceBase, Service, Method } from 'protobufjs';
import {
    ProtoField,
    ProtoMessage,
    ProtoEnum,
    ProtoEnumValue,
    ProtoOneof,
    ProtoService,
    ProtoRpc,
    ParsedProtoFile,
    Annotation
} from './types';

/**
 * Convert a protobufjs Field to internal ProtoField type.
 */
export function convertField(field: Field): ProtoField {
    let modifier: string | undefined;
    let fieldType: string;

    const fieldAny = field as any;
    if (fieldAny.map && fieldAny.keyType) {
        fieldType = `map<${fieldAny.keyType}, ${fieldAny.type}>`;
    } else {
        fieldType = field.type;

        if (field.rule === 'repeated') {
            modifier = 'repeated';
        } else if (field.partOf && field.partOf.name.startsWith('_')) {
            modifier = 'optional';
        }
    }

    const annotations: Annotation[] = [];
    if (field.options) {
        for (const [key, value] of Object.entries(field.options)) {
            if (key === 'proto3_optional') continue;
            annotations.push({ name: key, value: String(value) });
        }
    }

    return {
        name: field.name,
        type: fieldType,
        number: field.id,
        modifier,
        comment: field.comment || undefined,
        annotations: annotations.length > 0 ? annotations : undefined
    };
}

/**
 * Extract enum value annotations from raw proto file content.

 */
export function extractEnumValueAnnotations(content: string): Map<string, Map<string, Annotation[]>> {
    const result = new Map<string, Map<string, Annotation[]>>();

    // Match enum blocks
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    let enumMatch;

    while ((enumMatch = enumRegex.exec(content)) !== null) {
        const enumName = enumMatch[1];
        const enumBody = enumMatch[2];
        const valueAnnotations = new Map<string, Annotation[]>();

        // Match enum values with options: VALUE_NAME = 123 [option = value, ...];
        const valueRegex = /(\w+)\s*=\s*\d+\s*\[([^\]]+)\]/g;
        let valueMatch;

        while ((valueMatch = valueRegex.exec(enumBody)) !== null) {
            const valueName = valueMatch[1];
            const optionsStr = valueMatch[2];
            const annotations: Annotation[] = [];

            // Parse options like "deprecated = true, custom = value"
            const optionParts = optionsStr.split(',');
            for (const part of optionParts) {
                const eqIndex = part.indexOf('=');
                if (eqIndex > 0) {
                    const name = part.substring(0, eqIndex).trim();
                    const value = part.substring(eqIndex + 1).trim();
                    annotations.push({ name, value });
                }
            }

            if (annotations.length > 0) {
                valueAnnotations.set(valueName, annotations);
            }
        }

        if (valueAnnotations.size > 0) {
            result.set(enumName, valueAnnotations);
        }
    }

    return result;
}

/**
 * Convert a protobufjs Enum to internal ProtoEnum type.
 */
export function convertEnum(enumDef: Enum, valueAnnotations?: Map<string, Annotation[]>): ProtoEnum {
    const values: ProtoEnumValue[] = [];

    for (const [name, number] of Object.entries(enumDef.values)) {
        const value: ProtoEnumValue = {
            name,
            number: number as number
        };

        // Get annotations from raw file parsing (protobufjs doesn't parse these)
        if (valueAnnotations && valueAnnotations.has(name)) {
            value.annotations = valueAnnotations.get(name);
        }

        values.push(value);
    }

    values.sort((a, b) => a.number - b.number);

    return {
        name: enumDef.name,
        comment: enumDef.comment || undefined,
        values
    };
}

/**
 * Convert a protobufjs Type (message) to internal ProtoMessage type.
 */
export function convertMessage(msgDef: Type): ProtoMessage {
    const fields: ProtoField[] = [];
    const oneofs: ProtoOneof[] = [];

    const syntheticOneofNames = new Set<string>();
    for (const field of msgDef.fieldsArray) {
        if (field.partOf && field.partOf.name.startsWith('_')) {
            syntheticOneofNames.add(field.partOf.name);
        }
    }

    // Process real oneofs (non-synthetic)
    if (msgDef.oneofsArray) {
        for (const oneofDef of msgDef.oneofsArray) {
            if (syntheticOneofNames.has(oneofDef.name)) {
                continue; // Skip synthetic oneofs
            }

            const oneofFields: ProtoField[] = [];
            for (const field of oneofDef.fieldsArray) {
                oneofFields.push({
                    name: field.name,
                    type: field.type,
                    number: field.id,
                    comment: field.comment || undefined,
                    annotations: field.options
                        ? Object.entries(field.options).map(([k, v]) => ({ name: k, value: String(v) }))
                        : undefined
                });
            }

            oneofFields.sort((a, b) => a.number - b.number);

            oneofs.push({
                name: oneofDef.name,
                comment: oneofDef.comment || undefined,
                fields: oneofFields
            });
        }
    }

    // Collect all oneof field names (real oneofs only) to exclude from regular fields
    const oneofFieldNames = new Set<string>();
    if (msgDef.oneofsArray) {
        for (const oneofDef of msgDef.oneofsArray) {
            if (!syntheticOneofNames.has(oneofDef.name)) {
                for (const field of oneofDef.fieldsArray) {
                    oneofFieldNames.add(field.name);
                }
            }
        }
    }

    // Convert regular fields (excluding real oneof fields)
    for (const field of msgDef.fieldsArray) {
        if (!oneofFieldNames.has(field.name)) {
            fields.push(convertField(field));
        }
    }

    fields.sort((a, b) => a.number - b.number);

    return {
        name: msgDef.name,
        comment: msgDef.comment || undefined,
        fields,
        oneofs: oneofs.length > 0 ? oneofs : undefined
    };
}

/**
 * Convert a protobufjs Service to internal ProtoService type.
 */
export function convertService(serviceDef: Service): ProtoService {
    const rpcs: ProtoRpc[] = [];

    for (const method of serviceDef.methodsArray) {
        rpcs.push({
            name: method.name,
            requestType: method.requestType,
            responseType: method.responseType,
            comment: method.comment || undefined
        });
    }

    return {
        name: serviceDef.name,
        comment: serviceDef.comment || undefined,
        rpcs
    };
}

/**
 * Parse a .proto file and return internal types.
 */
export function parseProtoFile(filePath: string): ParsedProtoFile {
    const content = readFileSync(filePath, 'utf8');
    const parsed = parse(content, { keepCase: true, alternateCommentMode: true });

    // Extract enum value annotations from raw content (protobufjs doesn't parse these)
    const enumValueAnnotations = extractEnumValueAnnotations(content);

    const messages: ProtoMessage[] = [];
    const enums: ProtoEnum[] = [];
    const services: ProtoService[] = [];

    function traverse(ns: NamespaceBase) {
        if (ns.nestedArray) {
            for (const nested of ns.nestedArray) {
                if (nested instanceof Type) {
                    messages.push(convertMessage(nested));
                } else if (nested instanceof Enum) {
                    const annotations = enumValueAnnotations.get(nested.name);
                    enums.push(convertEnum(nested, annotations));
                } else if (nested instanceof Service) {
                    services.push(convertService(nested));
                } else if (nested instanceof Namespace) {
                    traverse(nested);
                }
            }
        }
    }

    traverse(parsed.root);

    return { messages, enums, services };
}
