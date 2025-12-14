/**
 * Merger module: Compare and merge messages/enums for backward compatibility.
 *
 * Rules:
 * - If modifier changed (optional added/removed) → ERROR
 * - If type changed → ERROR
 * - If field only in source but not upcoming → mark [deprecated = true]
 * - If field only in upcoming but not source → add at end with new field number
 */

import {
    ProtoField,
    ProtoMessage,
    ProtoEnum,
    ProtoEnumValue,
    ProtoOneof
} from './types';

/**
 * Merge a source message with an upcoming message.
 * Errors are pushed to the errors array.
 */
export function mergeMessage(
    sourceMsg: ProtoMessage,
    upcomingMsg: ProtoMessage,
    errors: string[]
): ProtoMessage {
    const sourceFieldMap = new Map(sourceMsg.fields.map(f => [f.name, f]));
    const upcomingFieldMap = new Map(upcomingMsg.fields.map(f => [f.name, f]));

    let maxFieldNumber = 0;
    const mergedFields: ProtoField[] = [];

    for (const sourceField of sourceMsg.fields) {
        maxFieldNumber = Math.max(maxFieldNumber, sourceField.number);

        const upcomingField = upcomingFieldMap.get(sourceField.name);

        if (upcomingField) {
            checkFieldCompatibility(sourceMsg.name, sourceField, upcomingField, errors);
            mergedFields.push(sourceField);
        } else {
            mergedFields.push(markDeprecated(sourceMsg.name, sourceField));
        }
    }

    // Merge oneofs
    let mergedOneofs: ProtoOneof[] | undefined;
    if (sourceMsg.oneofs) {
        const upcomingOneofMap = new Map(
            (upcomingMsg.oneofs || []).map(o => [o.name, o])
        );

        mergedOneofs = [];
        for (const sourceOneof of sourceMsg.oneofs) {
            const sourceOneofFieldMap = new Map(sourceOneof.fields.map(f => [f.name, f]));
            const upcomingOneof = upcomingOneofMap.get(sourceOneof.name);
            const upcomingOneofFieldMap = new Map(
                (upcomingOneof?.fields || []).map(f => [f.name, f])
            );

            const mergedOneofFields: ProtoField[] = [];

            for (const sourceField of sourceOneof.fields) {
                maxFieldNumber = Math.max(maxFieldNumber, sourceField.number);

                const upcomingField = upcomingOneofFieldMap.get(sourceField.name);
                if (upcomingField) {
                    checkFieldCompatibility(sourceMsg.name, sourceField, upcomingField, errors);
                    mergedOneofFields.push(sourceField);
                } else {
                    mergedOneofFields.push(markDeprecated(sourceMsg.name, sourceField));
                }
            }

            // Add new oneof fields from upcoming
            if (upcomingOneof) {
                for (const upcomingField of upcomingOneof.fields) {
                    if (!sourceOneofFieldMap.has(upcomingField.name)) {
                        maxFieldNumber++;
                        mergedOneofFields.push({
                            ...upcomingField,
                            number: maxFieldNumber
                        });
                    }
                }
            }

            mergedOneofs.push({
                ...sourceOneof,
                fields: mergedOneofFields
            });
        }
    }

    // Fields only in upcoming - add at the end with new field numbers
    for (const [, upcomingField] of upcomingFieldMap) {
        if (!sourceFieldMap.has(upcomingField.name)) {
            maxFieldNumber++;
            mergedFields.push({
                ...upcomingField,
                number: maxFieldNumber
            });
        }
    }

    return {
        ...sourceMsg,
        fields: mergedFields,
        oneofs: mergedOneofs
    };
}

/**
 * Check field compatibility between source and upcoming.
 */
function checkFieldCompatibility(
    msgName: string,
    sourceField: ProtoField,
    upcomingField: ProtoField,
    errors: string[]
): void {
    // Check if modifier changed
    const sourceModifier = sourceField.modifier || '';
    const upcomingModifier = upcomingField.modifier || '';
    if (sourceModifier !== upcomingModifier) {
        errors.push(
            `${msgName}.${sourceField.name}: MODIFIER CHANGED - ` +
            `"${sourceModifier || '(none)'}" → "${upcomingModifier || '(none)'}"`
        );
    }

    // TODO: add support for type change
    if (sourceField.type !== upcomingField.type) {
        errors.push(
            `${msgName}.${sourceField.name}: TYPE CHANGED - ` +
            `"${sourceField.type}" → "${upcomingField.type}"`
        );
    }
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
