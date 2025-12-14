/**
 * Parser module: Load .proto files and convert to internal types.
 */

import { readFileSync } from 'fs';
import { parse, Field, Enum, Type, Namespace, NamespaceBase } from 'protobufjs';
import {
    ProtoField,
    ProtoMessage,
    ProtoEnum,
    ProtoEnumValue,
    ProtoOneof,
    ParsedProtoFile,
    FieldOption
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

    const options: FieldOption[] = [];
    if (field.options) {
        for (const [key, value] of Object.entries(field.options)) {
            if (key === 'proto3_optional') continue;
            options.push({ name: key, value: String(value) });
        }
    }

    return {
        name: field.name,
        type: fieldType,
        number: field.id,
        modifier,
        comment: field.comment || undefined,
        options: options.length > 0 ? options : undefined
    };
}

/**
 * Convert a protobufjs Enum to internal ProtoEnum type.
 */
export function convertEnum(enumDef: Enum): ProtoEnum {
    const values: ProtoEnumValue[] = [];

    for (const [name, number] of Object.entries(enumDef.values)) {
        const value: ProtoEnumValue = {
            name,
            number: number as number
        };

        const valuesOptions = (enumDef as any).valuesOptions;
        if (valuesOptions && valuesOptions[name]) {
            value.options = Object.entries(valuesOptions[name]).map(([k, v]) => ({
                name: k,
                value: String(v)
            }));
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
                    options: field.options
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
 * Parse a .proto file and return internal types.
 */
export function parseProtoFile(filePath: string): ParsedProtoFile {
    const content = readFileSync(filePath, 'utf8');
    const parsed = parse(content, { keepCase: true, alternateCommentMode: true });

    const messages: ProtoMessage[] = [];
    const enums: ProtoEnum[] = [];

    function traverse(ns: NamespaceBase) {
        if (ns.nestedArray) {
            for (const nested of ns.nestedArray) {
                if (nested instanceof Type) {
                    messages.push(convertMessage(nested));
                } else if (nested instanceof Enum) {
                    enums.push(convertEnum(nested));
                } else if (nested instanceof Namespace) {
                    traverse(nested);
                }
            }
        }
    }

    traverse(parsed.root);

    return { messages, enums };
}
