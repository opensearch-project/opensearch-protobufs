/**
 * Merger module: Compare and merge messages/enums for backward compatibility.
 */

import {
    ProtoField,
    ProtoMessage,
    ProtoEnum,
    ProtoEnumValue,
    ProtoOneof,
    Annotation
} from './types';

const DEPRECATED: Annotation = { name: 'deprecated', value: 'true' };

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

/** Type with annotations array */
type HasAnnotations = { annotations?: Annotation[] };

/**
 * Check if an item is already deprecated.
 */
function isDeprecated(item: HasAnnotations): boolean {
    return item.annotations?.some(a =>
        a.name === DEPRECATED.name && a.value === DEPRECATED.value
    ) ?? false;
}

/**
 * Add deprecated annotation to an item if not already deprecated.
 */
function addDeprecated<T extends HasAnnotations>(item: T): T {
    if (isDeprecated(item)) {
        return item;
    }
    return {
        ...item,
        annotations: [...(item.annotations || []), DEPRECATED]
    };
}

/**
 * Check if optional added or removed. If so, push error and return true
 */
function hasOptionalError(
    source: ProtoField,
    upcoming: ProtoField,
    msgName: string,
    errors: string[]
): boolean {
    const sourceOptional = source.modifier === 'optional';
    const upcomingOptional = upcoming.modifier === 'optional';

    if (sourceOptional !== upcomingOptional) {
        const change = sourceOptional ? 'removed' : 'added';
        errors.push(`${msgName}.${source.name}: optional ${change}`);
        return true;
    }
    return false;
}

/**
 * Check if two fields are compatible (same type and compatible modifiers).
 */
function fieldsMatch(a: ProtoField, b: ProtoField): boolean {
    return a.type === b.type && (a.modifier || '') === (b.modifier || '');
}

/**
 * Merge a source field with upcoming map.
 */
function mergeField(
    sourceField: ProtoField,
    upcomingMap: Map<string, ProtoField>,
    msgName: string,
    errors: string[]
): ProtoField {
    if (isDeprecated(sourceField)) {
        return sourceField;
    }

    const baseName = getBaseName(sourceField.name);
    const upcomingField = upcomingMap.get(baseName);

    if (upcomingField) {
        upcomingMap.delete(baseName);

        if (hasOptionalError(sourceField, upcomingField, msgName, errors)) {
            return sourceField;
        }

        if (fieldsMatch(sourceField, upcomingField)) {
            return sourceField;
        } else {
            // Type or repeated change - deprecate and version
            const newName = `${baseName}_${getFieldVersion(sourceField.name) + 1}`;
            upcomingMap.set(newName, { ...upcomingField, name: newName });
            return addDeprecated(sourceField);
        }
    } else {
        return addDeprecated(sourceField);
    }
}

/**
 * Merge a source message with an upcoming message.
 */
export function mergeMessage(
    sourceMsg: ProtoMessage,
    upcomingMsg: ProtoMessage,
    errors: string[]
): ProtoMessage {
    const upcomingByName = new Map(upcomingMsg.fields.map(f => [f.name, f]));

    let maxFieldNumber = 0;
    const mergedFields: ProtoField[] = [];

    // Process regular fields
    for (const sourceField of sourceMsg.fields) {
        maxFieldNumber = Math.max(maxFieldNumber, sourceField.number);
        mergedFields.push(mergeField(sourceField, upcomingByName, sourceMsg.name, errors));
    }

    // Process oneofs
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
                mergedOneofFields.push(mergeField(sourceField, upcomingOneofByName, sourceMsg.name, errors));
            }

            mergedOneofs.push({ ...sourceOneof, fields: mergedOneofFields });
            oneofMaps.set(sourceOneof.name, upcomingOneofByName);
        }
    }

    // Assign field max number to remaining fields.
    for (const field of upcomingByName.values()) {
        mergedFields.push({ ...field, number: ++maxFieldNumber });
    }

    // Assign field max number to remaining oneof fields.
    if (mergedOneofs) {
        for (const oneof of mergedOneofs) {
            const remaining = oneofMaps.get(oneof.name);
            if (remaining) {
                for (const field of remaining.values()) {
                    oneof.fields.push({ ...field, number: ++maxFieldNumber });
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
 * Merge a source enum with an upcoming enum.
 */
export function mergeEnum(
    sourceEnum: ProtoEnum,
    upcomingEnum: ProtoEnum
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
            mergedValues.push(addDeprecated(sourceValue));
        }
    }

    for (const [valueName, upcomingValue] of upcomingValueMap) {
        if (!sourceValueMap.has(valueName)) {
            mergedValues.push({
                ...upcomingValue,
                number: ++maxValueNumber
            });
        }
    }

    return {
        ...sourceEnum,
        values: mergedValues
    };
}
