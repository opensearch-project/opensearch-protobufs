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
import { CompatibilityReporter, formatField } from './CompatibilityReporter';

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
    reporter?: CompatibilityReporter
): ProtoField {
    if (isDeprecated(sourceField)) {
        return sourceField;
    }

    const baseName = getBaseName(sourceField.name);
    const upcomingField = upcomingMap.get(baseName);

    if (upcomingField) {
        upcomingMap.delete(baseName);

        if (fieldsMatch(sourceField, upcomingField)) {
            return sourceField;
        } else {
            const sameType = sourceField.type === upcomingField.type;
            const sourceOptional = sourceField.modifier === 'optional';
            const upcomingOptional = upcomingField.modifier === 'optional';
            const isOptionalChange = sameType && (sourceOptional !== upcomingOptional);

            if (isOptionalChange) {
                reporter?.addFieldChange({
                    messageName: msgName,
                    changeType: 'OPTIONAL CHANGE',
                    fieldName: sourceField.name,
                    existingType: formatField({ ...sourceField, number: sourceField.number }),
                    incomingType: formatField({ ...upcomingField, number: sourceField.number })
                });
                return { ...upcomingField, name: sourceField.name, number: sourceField.number };
            } else {
                const newName = `${baseName}_${getFieldVersion(sourceField.name) + 1}`;
                upcomingMap.set(newName, { ...upcomingField, name: newName });

                reporter?.addFieldChange({
                    messageName: msgName,
                    changeType: 'TYPE CHANGED',
                    fieldName: sourceField.name,
                    existingType: formatField({ ...sourceField, number: sourceField.number, deprecated: true }),
                    incomingType: formatField(upcomingField),
                    versionedName: newName
                });
                return addDeprecated(sourceField);
            }
        }
    } else {
        reporter?.addFieldChange({
            messageName: msgName,
            changeType: 'REMOVED',
            fieldName: sourceField.name,
            existingType: formatField({ ...sourceField, number: sourceField.number, deprecated: true })
        });
        return addDeprecated(sourceField);
    }
}

/** Check if field name is a versioned name (ends with _N where N is a number) */
function isVersionedName(name: string): boolean {
    return /_\d+$/.test(name);
}

/** Check if message has any oneof with fields */
function hasOneof(msg: ProtoMessage): boolean {
    return (msg.oneofs?.some(o => o.fields.length > 0)) ?? false;
}

/**
 * Merge a source message with an upcoming message.
 */
export function mergeMessage(
    sourceMsg: ProtoMessage,
    upcomingMsg: ProtoMessage,
    reporter?: CompatibilityReporter
): ProtoMessage {
    // Check for oneof structure change (one has oneof, other doesn't)
    const sourceHasOneof = hasOneof(sourceMsg);
    const upcomingHasOneof = hasOneof(upcomingMsg);

    if (sourceHasOneof !== upcomingHasOneof) {
        reporter?.addFieldChange({
            messageName: sourceMsg.name,
            changeType: 'ONEOF CHANGE',
            fieldName: '*',
            existingLocation: sourceHasOneof ? 'has oneof' : 'no oneof',
            incomingLocation: upcomingHasOneof ? 'has oneof' : 'no oneof'
        });
    }

    const upcomingByName = new Map(upcomingMsg.fields.map(f => [f.name, f]));

    let maxFieldNumber = 0;
    const mergedFields: ProtoField[] = [];

    // Process regular fields
    for (const sourceField of sourceMsg.fields) {
        maxFieldNumber = Math.max(maxFieldNumber, sourceField.number);
        mergedFields.push(mergeField(sourceField, upcomingByName, sourceMsg.name, reporter));
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
                mergedOneofFields.push(mergeField(sourceField, upcomingOneofByName, sourceMsg.name, reporter));
            }

            mergedOneofs.push({ ...sourceOneof, fields: mergedOneofFields });
            oneofMaps.set(sourceOneof.name, upcomingOneofByName);
        }
    }

    // Assign field max number to remaining fields.
    for (const field of upcomingByName.values()) {
        const fieldNumber = ++maxFieldNumber;
        if (!isVersionedName(field.name)) {
            reporter?.addFieldChange({
                messageName: sourceMsg.name,
                changeType: 'ADDED',
                fieldName: field.name,
                incomingType: formatField({ ...field, number: fieldNumber })
            });
        }
        mergedFields.push({ ...field, number: fieldNumber });
    }

    // Assign field max number to remaining oneof fields.
    if (mergedOneofs) {
        for (const oneof of mergedOneofs) {
            const remaining = oneofMaps.get(oneof.name);
            if (remaining) {
                for (const field of remaining.values()) {
                    const fieldNumber = ++maxFieldNumber;
                    if (!isVersionedName(field.name)) {
                        reporter?.addFieldChange({
                            messageName: sourceMsg.name,
                            changeType: 'ADDED',
                            fieldName: `${oneof.name}.${field.name}`,
                            incomingType: formatField({ ...field, number: fieldNumber })
                        });
                    }
                    oneof.fields.push({ ...field, number: fieldNumber });
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
    upcomingEnum: ProtoEnum,
    reporter?: CompatibilityReporter
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
            reporter?.addEnumChange({
                enumName: sourceEnum.name,
                changeType: 'REMOVED',
                valueName: sourceValue.name
            });
            mergedValues.push(addDeprecated(sourceValue));
        }
    }

    for (const [valueName, upcomingValue] of upcomingValueMap) {
        if (!sourceValueMap.has(valueName)) {
            reporter?.addEnumChange({
                enumName: sourceEnum.name,
                changeType: 'ADDED',
                valueName: valueName
            });
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
