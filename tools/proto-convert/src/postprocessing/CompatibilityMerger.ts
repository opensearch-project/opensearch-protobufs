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
const TOOLING_SKIP: Annotation = { name: '(tooling_skip)', value: 'true' };

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
    return match ? parseInt(match[1], 10) : 1;
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
 * Check if an item has tooling_skip option set to true.
 * Fields with this option are manually maintained and won't be deprecated.
 */
function hasToolingSkip(item: HasAnnotations): boolean {
    return item.annotations?.some(a =>
        a.name === TOOLING_SKIP.name && a.value === TOOLING_SKIP.value
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
    versionMap: Map<string, number>,
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
            const newName = nextVersionedName(baseName, versionMap);

            if (isOptionalChange) {
                upcomingMap.set(newName, { ...upcomingField, name: newName, comment: sourceField.comment });
                reporter?.addFieldChange({
                    messageName: msgName,
                    changeType: 'OPTIONAL CHANGE',
                    fieldName: sourceField.name,
                    existingType: formatField({ ...sourceField, number: sourceField.number, deprecated: true }),
                    incomingType: formatField(upcomingField),
                    versionedName: newName
                });
                return addDeprecated(sourceField);
            } else {
                upcomingMap.set(newName, { ...upcomingField, name: newName, comment: sourceField.comment });

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
        if (hasToolingSkip(sourceField)) {
            return sourceField;
        }
        reporter?.addFieldChange({
            messageName: msgName,
            changeType: 'DEPRECATED',
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

/**
 * Convert a name to snake_case variable name format.
 */
function toVarName(name: string): string {
    name = name.replace(/^_+/, '');

    return name
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/(\d)([A-Za-z])/g, '$1_$2')
        .toLowerCase();
}

/**
 * Check if field name is the formatted (snake_case) version of the type name.
 */
function isFormattedName(fieldName: string, typeName: string): boolean {
    return fieldName === toVarName(typeName);
}

/** Check if message has any oneof with fields */
function hasOneof(msg: ProtoMessage): boolean {
    return (msg.oneofs?.some(o => o.fields.length > 0)) ?? false;
}

function collectMaxVersions(msg: ProtoMessage): Map<string, number> {
    const versions = new Map<string, number>();

    const track = (field: ProtoField): void => {
        const baseName = getBaseName(field.name);
        const version = getFieldVersion(field.name);
        versions.set(baseName, Math.max(versions.get(baseName) ?? 1, version));
    };

    for (const field of msg.fields) {
        track(field);
    }

    for (const oneof of msg.oneofs || []) {
        for (const field of oneof.fields) {
            track(field);
        }
    }

    return versions;
}

function nextVersionedName(baseName: string, versionMap: Map<string, number>): string {
    const nextVersion = (versionMap.get(baseName) ?? 1) + 1;
    versionMap.set(baseName, nextVersion);
    return `${baseName}_${nextVersion}`;
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
    const upcomingOneofs = upcomingMsg.oneofs || [];
    const versionMap = collectMaxVersions(sourceMsg);

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
    const usedFieldNumbers = new Set<number>();
    const mergedFields: ProtoField[] = [];

    // Process regular fields
    for (const sourceField of sourceMsg.fields) {
        maxFieldNumber = Math.max(maxFieldNumber, sourceField.number);
        const mergedField = mergeField(sourceField, upcomingByName, versionMap, sourceMsg.name, reporter);
        usedFieldNumbers.add(mergedField.number);
        mergedFields.push(mergedField);
    }

    // Process oneofs
    let mergedOneofs: ProtoOneof[] | undefined;
    const oneofMaps: Map<string, Map<string, ProtoField>> = new Map();

    if (sourceMsg.oneofs) {
        const upcomingOneofMap = new Map(
            upcomingOneofs.map(o => [o.name, o])
        );

        mergedOneofs = [];
        for (const sourceOneof of sourceMsg.oneofs) {
            const upcomingOneof = upcomingOneofMap.get(sourceOneof.name);
            const upcomingFields = upcomingOneof?.fields || [];
            const upcomingOneofByName = new Map(
                upcomingFields.map(f => [f.name, f])
            );

            const sourceTypes = sourceOneof.fields.map(f => f.type);
            const allTypesUnique = new Set(sourceTypes).size === sourceTypes.length;

            // Build type-based map if types are unique
            const upcomingByType = allTypesUnique
                ? new Map(upcomingFields.map(f => [f.type, f]))
                : new Map<string, ProtoField>();

            const mergedOneofFields: ProtoField[] = [];
            for (const sourceField of sourceOneof.fields) {
                maxFieldNumber = Math.max(maxFieldNumber, sourceField.number);

                // Name match
                if (upcomingOneofByName.has(getBaseName(sourceField.name))) {
                    mergedOneofFields.push(mergeField(sourceField, upcomingOneofByName, versionMap, sourceMsg.name, reporter));
                    continue;
                }

                // Type match with formatted name
                if (allTypesUnique && upcomingByType.has(sourceField.type) && isFormattedName(sourceField.name, sourceField.type)) {
                    const upcomingField = upcomingByType.get(sourceField.type)!;

                    mergedOneofFields.push({
                        ...upcomingField,
                        number: sourceField.number,
                        comment: sourceField.comment || upcomingField.comment
                    });
                    usedFieldNumbers.add(sourceField.number);

                    upcomingOneofByName.delete(upcomingField.name);
                    upcomingByType.delete(sourceField.type);

                    reporter?.addFieldChange({
                        messageName: sourceMsg.name,
                        changeType: 'RENAMED',
                        fieldName: `${sourceOneof.name}.${sourceField.name}`,
                        incomingType: `→ ${sourceOneof.name}.${upcomingField.name}`
                    });
                    continue;
                }

                // Try 3: No match - deprecate or skip
                mergedOneofFields.push(mergeField(sourceField, upcomingOneofByName, versionMap, sourceMsg.name, reporter));
            }

            mergedOneofs.push({ ...sourceOneof, fields: mergedOneofFields });
            oneofMaps.set(sourceOneof.name, upcomingOneofByName);
        }
    } else if (upcomingHasOneof) {
        const sourceFieldByName = new Map(
            sourceMsg.fields.map(f => [getBaseName(f.name), f])
        );
        mergedOneofs = [];

        for (const upcomingOneof of upcomingOneofs) {
            const mergedOneofFields: ProtoField[] = [];

            for (const field of upcomingOneof.fields) {
                const sourceField = sourceFieldByName.get(getBaseName(field.name));
                let oneofField = { ...field };
                let fieldNumber = field.number;

                if (sourceField) {
                    oneofField = {
                        ...oneofField,
                        name: nextVersionedName(getBaseName(sourceField.name), versionMap),
                        comment: sourceField.comment || field.comment
                    };
                }

                if (sourceField || usedFieldNumbers.has(fieldNumber)) {
                    do {
                        fieldNumber = ++maxFieldNumber;
                    } while (usedFieldNumbers.has(fieldNumber));
                }
                maxFieldNumber = Math.max(maxFieldNumber, fieldNumber);
                usedFieldNumbers.add(fieldNumber);

                reporter?.addFieldChange({
                    messageName: sourceMsg.name,
                    changeType: 'ADDED',
                    fieldName: `${upcomingOneof.name}.${oneofField.name}`,
                    incomingType: formatField({ ...oneofField, number: fieldNumber })
                });
                mergedOneofFields.push({ ...oneofField, number: fieldNumber });
            }

            mergedOneofs.push({ ...upcomingOneof, fields: mergedOneofFields });
        }
    }

    // Assign field max number to remaining fields.
    for (const field of upcomingByName.values()) {
        let addedField = { ...field };
        if (!isVersionedName(addedField.name) && versionMap.has(getBaseName(addedField.name))) {
            addedField = {
                ...addedField,
                name: nextVersionedName(getBaseName(addedField.name), versionMap)
            };
        }

        const fieldNumber = ++maxFieldNumber;
        if (isVersionedName(addedField.name)) {
            reporter?.updateVersionedNumber(addedField.name, fieldNumber);
        } else {
            reporter?.addFieldChange({
                messageName: sourceMsg.name,
                changeType: 'ADDED',
                fieldName: addedField.name,
                incomingType: formatField({ ...addedField, number: fieldNumber })
            });
        }
        usedFieldNumbers.add(fieldNumber);
        mergedFields.push({ ...addedField, number: fieldNumber });
    }

    // Assign field max number to remaining oneof fields.
    if (mergedOneofs) {
        for (const oneof of mergedOneofs) {
            const remaining = oneofMaps.get(oneof.name);
            if (remaining) {
                for (const field of remaining.values()) {
                    let addedField = { ...field };
                    if (!isVersionedName(addedField.name) && versionMap.has(getBaseName(addedField.name))) {
                        addedField = {
                            ...addedField,
                            name: nextVersionedName(getBaseName(addedField.name), versionMap)
                        };
                    }
                    const fieldNumber = ++maxFieldNumber;
                    if (isVersionedName(addedField.name)) {
                        reporter?.updateVersionedNumber(addedField.name, fieldNumber);
                    } else {
                        reporter?.addFieldChange({
                            messageName: sourceMsg.name,
                            changeType: 'ADDED',
                            fieldName: `${oneof.name}.${addedField.name}`,
                            incomingType: formatField({ ...addedField, number: fieldNumber })
                        });
                    }
                    usedFieldNumbers.add(fieldNumber);
                    oneof.fields.push({ ...addedField, number: fieldNumber });
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

        if (isDeprecated(sourceValue)) {
            mergedValues.push(sourceValue);
            continue;
        }

        const upcomingValue = upcomingValueMap.get(sourceValue.name);

        if (upcomingValue) {
            mergedValues.push(sourceValue);
        } else {
            reporter?.addEnumChange({
                enumName: sourceEnum.name,
                changeType: 'DEPRECATED',
                valueName: sourceValue.name,
                valueNumber: sourceValue.number
            });
            mergedValues.push(addDeprecated(sourceValue));
        }
    }

    for (const [valueName, upcomingValue] of upcomingValueMap) {
        if (!sourceValueMap.has(valueName)) {
            const valueNumber = ++maxValueNumber;
            reporter?.addEnumChange({
                enumName: sourceEnum.name,
                changeType: 'ADDED',
                valueName: valueName,
                valueNumber: valueNumber
            });
            mergedValues.push({
                ...upcomingValue,
                number: valueNumber
            });
        }
    }

    return {
        ...sourceEnum,
        values: mergedValues
    };
}
