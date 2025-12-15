/**
 * Merger module: Compare and merge messages/enums for backward compatibility.
 *
 */

import {
    ProtoField,
    ProtoMessage,
    ProtoEnum,
    ProtoEnumValue,
    ProtoOneof
} from './types';

/**
 * Extract base name
 */
function getBaseName(fieldName: string): string {
    const match = fieldName.match(/^(.+?)_(\d+)$/);
    return match ? match[1] : fieldName;
}

/**
 * Get the current version suffix from field name
 */
function getFieldVersion(fieldName: string): number {
    const match = fieldName.match(/_(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check if a field is already deprecated.
 */
function isDeprecated(field: ProtoField): boolean {
    return field.options?.some(opt => opt.name === 'deprecated' && opt.value === 'true') ?? false;
}

/**
 * Check if two fields are compatible (same type and modifier).
 */
function fieldsMatch(a: ProtoField, b: ProtoField): boolean {
    return a.type === b.type && (a.modifier || '') === (b.modifier || '');
}

/**
 * Merge a source message with an upcoming message.
 * Errors are pushed to the errors array (currently unused but kept for future).
 */
export function mergeMessage(
    sourceMsg: ProtoMessage,
    upcomingMsg: ProtoMessage,
    _errors: string[]
): ProtoMessage {
    const upcomingByName = new Map(upcomingMsg.fields.map(f => [f.name, f]));

    let maxFieldNumber = 0;
    const mergedFields: ProtoField[] = [];

    for (const sourceField of sourceMsg.fields) {
        maxFieldNumber = Math.max(maxFieldNumber, sourceField.number);

        // Skip deprecated fields
        if (isDeprecated(sourceField)) {
            mergedFields.push(sourceField);
            continue;
        }

        const baseName = getBaseName(sourceField.name);
        const upcomingField = upcomingByName.get(baseName);

        if (upcomingField) {
            upcomingByName.delete(baseName);
            if (fieldsMatch(sourceField, upcomingField)) {
            mergedFields.push(sourceField);
            } else {
                mergedFields.push(markDeprecated(sourceMsg.name, sourceField));
                const currentVersion = getFieldVersion(sourceField.name);
                const newName = `${baseName}_${currentVersion + 1}`;
                upcomingByName.set(newName, { ...upcomingField, name: newName });
            }
        } else {
            mergedFields.push(markDeprecated(sourceMsg.name, sourceField));
        }
    }

    let mergedOneofs: ProtoOneof[] | undefined;
    const oneofMaps: Map<string, Map<string, ProtoField>> = new Map();

    if (sourceMsg.oneofs) {
        const upcomingOneofMap = new Map(
            (upcomingMsg.oneofs || []).map(o => [o.name, o])
        );

        mergedOneofs = [];
        for (const sourceOneof of sourceMsg.oneofs) {
            const upcomingOneof = upcomingOneofMap.get(sourceOneof.name);
            const upcomingOneofByName = new Map(
                (upcomingOneof?.fields || []).map(f => [f.name, f])
            );

            const mergedOneofFields: ProtoField[] = [];

            for (const sourceField of sourceOneof.fields) {
                maxFieldNumber = Math.max(maxFieldNumber, sourceField.number);
                // Skip deprecated fields
                if (isDeprecated(sourceField)) {
                    mergedOneofFields.push(sourceField);
                    continue;
                }

                const baseName = getBaseName(sourceField.name);
                const upcomingField = upcomingOneofByName.get(baseName);

                if (upcomingField) {
                    upcomingOneofByName.delete(baseName);
                    if (fieldsMatch(sourceField, upcomingField)) {
                    mergedOneofFields.push(sourceField);
                    } else {
                        mergedOneofFields.push(markDeprecated(sourceMsg.name, sourceField));
                        const currentVersion = getFieldVersion(sourceField.name);
                        const newName = `${baseName}_${currentVersion + 1}`;
                        upcomingOneofByName.set(newName, { ...upcomingField, name: newName });
                    }
                } else {
                    mergedOneofFields.push(markDeprecated(sourceMsg.name, sourceField));
                }
            }

            mergedOneofs.push({
                ...sourceOneof,
                fields: mergedOneofFields
            });
            oneofMaps.set(sourceOneof.name, upcomingOneofByName);
        }
    }

    // Assign field max number to remaining fields.
    for (const field of upcomingByName.values()) {
        maxFieldNumber++;
        mergedFields.push({ ...field, number: maxFieldNumber });
    }

    // Assign field max number to remaining oneof fields.
    if (mergedOneofs) {
        for (const oneof of mergedOneofs) {
            const remaining = oneofMaps.get(oneof.name);
            if (remaining) {
                for (const field of remaining.values()) {
            maxFieldNumber++;
                    oneof.fields.push({ ...field, number: maxFieldNumber });
                }
            }
        }
    }

    return {
        ...sourceMsg,
        fields: mergedFields,
        oneofs: mergedOneofs
    };
}

/**
 * Mark a field as deprecated if not already.
 */
function markDeprecated(msgName: string, field: ProtoField): ProtoField {
    const isAlreadyDeprecated = field.options?.some(
        opt => opt.name === 'deprecated' && opt.value === 'true'
    );

    if (!isAlreadyDeprecated) {
        return {
            ...field,
            options: [...(field.options || []), { name: 'deprecated', value: 'true' }]
        };
    }
    return field;
}

/**
 * Merge a source enum with an upcoming enum.
 * Errors are pushed to the errors array.
 */
export function mergeEnum(
    sourceEnum: ProtoEnum,
    upcomingEnum: ProtoEnum,
    errors: string[]
): ProtoEnum {
    const sourceValueMap = new Map(sourceEnum.values.map(v => [v.name, v]));
    const upcomingValueMap = new Map(upcomingEnum.values.map(v => [v.name, v]));

    let maxValueNumber = 0;
    const mergedValues: ProtoEnumValue[] = [];

    for (const sourceValue of sourceEnum.values) {
        maxValueNumber = Math.max(maxValueNumber, sourceValue.number);

        const upcomingValue = upcomingValueMap.get(sourceValue.name);

        if (upcomingValue) {
            mergedValues.push(sourceValue);
        } else {
            const isAlreadyDeprecated = sourceValue.options?.some(
                opt => opt.name === 'deprecated' && opt.value === 'true'
            );

            if (!isAlreadyDeprecated) {
                mergedValues.push({
                    ...sourceValue,
                    options: [...(sourceValue.options || []), { name: 'deprecated', value: 'true' }]
                });
            } else {
                mergedValues.push(sourceValue);
            }
        }
    }

    for (const [valueName, upcomingValue] of upcomingValueMap) {
        if (!sourceValueMap.has(valueName)) {
            maxValueNumber++;
            mergedValues.push({
                ...upcomingValue,
                number: maxValueNumber
            });
        }
    }

    return {
        ...sourceEnum,
        values: mergedValues
    };
}
