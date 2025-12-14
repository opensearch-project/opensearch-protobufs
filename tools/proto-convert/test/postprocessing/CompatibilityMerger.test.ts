/**
 * Tests for the merger module.
 */

import { mergeMessage, mergeEnum } from '../../src/postprocessing/CompatibilityMerger';
import { ProtoMessage, ProtoEnum, ProtoField, ProtoEnumValue } from '../../src/postprocessing/types';

describe('mergeMessage', () => {
    const field = (name: string, type: string, number: number, modifier?: string): ProtoField => ({
        name,
        type,
        number,
        modifier
    });

    describe('field preservation', () => {
        it('should preserve fields that exist in both source and upcoming', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('id', 'int32', 1),
                    field('name', 'string', 2)
                ]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('id', 'int32', 1),
                    field('name', 'string', 2)
                ]
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            expect(result.fields).toHaveLength(2);
            expect(result.fields[0].name).toBe('id');
            expect(result.fields[0].number).toBe(1);
            expect(result.fields[1].name).toBe('name');
            expect(result.fields[1].number).toBe(2);
        });

        it('should preserve original field numbers from source', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('id', 'int32', 1),
                    field('name', 'string', 2)
                ]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('id', 'int32', 2),
                    field('name', 'string', 3)
                ]
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            // Source field numbers should be preserved
            expect(result.fields[0].number).toBe(1);
            expect(result.fields[1].number).toBe(2);
        });
    });

    describe('modifier changes (breaking)', () => {
        it('should error when optional is added', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1, 'optional')]
            };
            const errors: string[] = [];

            mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('MODIFIER CHANGED');
            expect(errors[0]).toContain('(none)');
            expect(errors[0]).toContain('optional');
        });

        it('should error when optional is removed', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1, 'optional')]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1)]
            };
            const errors: string[] = [];

            mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('MODIFIER CHANGED');
            expect(errors[0]).toContain('optional');
            expect(errors[0]).toContain('(none)');
        });

        it('should error when repeated is added', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('items', 'string', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('items', 'string', 1, 'repeated')]
            };
            const errors: string[] = [];

            mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('MODIFIER CHANGED');
        });
    });

    describe('type changes (breaking)', () => {
        it('should error when type changes', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int64', 1)]
            };
            const errors: string[] = [];

            mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('TYPE CHANGED');
            expect(errors[0]).toContain('int32');
            expect(errors[0]).toContain('int64');
        });

        it('should error when message type changes', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('data', 'OldType', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('data', 'NewType', 1)]
            };
            const errors: string[] = [];

            mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('TYPE CHANGED');
            expect(errors[0]).toContain('OldType');
            expect(errors[0]).toContain('NewType');
        });
    });

    describe('deprecated fields', () => {
        it('should deprecate fields that exist only in source', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('id', 'int32', 1),
                    field('old_field', 'string', 2)
                ]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1)]
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            expect(result.fields).toHaveLength(2);

            const deprecatedField = result.fields.find(f => f.name === 'old_field');
            expect(deprecatedField).toBeDefined();
            expect(deprecatedField!.options).toContainEqual({ name: 'deprecated', value: 'true' });
        });

        it('should not double-deprecate already deprecated fields', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [{
                    name: 'old_field',
                    type: 'string',
                    number: 1,
                    options: [{ name: 'deprecated', value: 'true' }]
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: []
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);

            const deprecatedField = result.fields[0];
            const deprecatedOptions = deprecatedField.options?.filter(
                o => o.name === 'deprecated' && o.value === 'true'
            );
            expect(deprecatedOptions).toHaveLength(1);
        });
    });

    describe('new fields', () => {
        it('should add new fields with incremented field numbers', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('id', 'int32', 1),
                    field('name', 'string', 2)
                ]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('id', 'int32', 1),
                    field('name', 'string', 2),
                    field('new_field', 'bool', 99)
                ]
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            expect(result.fields).toHaveLength(3);

            const newField = result.fields.find(f => f.name === 'new_field');
            expect(newField).toBeDefined();
            expect(newField!.number).toBe(3);
            expect(newField!.type).toBe('bool');
        });

        it('should handle multiple new fields with sequential numbers', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 5)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('id', 'int32', 5),
                    field('new1', 'string', 1),
                    field('new2', 'bool', 2)
                ]
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);

            expect(result.fields).toHaveLength(3);
            expect(result.fields[0].number).toBe(5);
            const new1 = result.fields.find(f => f.name === 'new1');
            const new2 = result.fields.find(f => f.name === 'new2');
            expect(new1!.number).toBe(6);
            expect(new2!.number).toBe(7);
        });
    });

    describe('oneof fields', () => {
        it('should preserve oneof fields that exist in both', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'value',
                    fields: [
                        field('str_val', 'string', 1),
                        field('int_val', 'int32', 2)
                    ]
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'value',
                    fields: [
                        field('str_val', 'string', 1),
                        field('int_val', 'int32', 2)
                    ]
                }]
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            expect(result.oneofs).toHaveLength(1);
            expect(result.oneofs![0].fields).toHaveLength(2);
        });

        it('should deprecate oneof fields that are removed', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'value',
                    fields: [
                        field('str_val', 'string', 1),
                        field('removed_val', 'bytes', 2)
                    ]
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'value',
                    fields: [field('str_val', 'string', 1)]
                }]
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            const removedField = result.oneofs![0].fields.find(f => f.name === 'removed_val');
            expect(removedField).toBeDefined();
            expect(removedField!.options).toContainEqual({ name: 'deprecated', value: 'true' });
        });

        it('should add new oneof fields with incremented numbers', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'value',
                    fields: [field('str_val', 'string', 1)]
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'value',
                    fields: [
                        field('str_val', 'string', 1),
                        field('new_val', 'double', 99)
                    ]
                }]
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            expect(result.oneofs![0].fields).toHaveLength(2);

            const newField = result.oneofs![0].fields.find(f => f.name === 'new_val');
            expect(newField).toBeDefined();
            expect(newField!.number).toBe(2);
            expect(newField!.type).toBe('double');
        });

        it('should error on type change in oneof field', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'value',
                    fields: [field('val', 'string', 1)]
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'value',
                    fields: [field('val', 'bytes', 1)]
                }]
            };
            const errors: string[] = [];

            mergeMessage(source, upcoming, errors);

            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('TYPE CHANGED');
        });

        it('should use global max field number across regular and oneof fields', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1)],
                oneofs: [{
                    name: 'value',
                    fields: [field('str_val', 'string', 5)]
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('id', 'int32', 1),
                    field('new_field', 'bool', 2)
                ],
                oneofs: [{
                    name: 'value',
                    fields: [
                        field('str_val', 'string', 3),
                        field('new_oneof_val', 'int64', 4)
                    ]
                }]
            };
            const errors: string[] = [];

            const result = mergeMessage(source, upcoming, errors);


            const newOneofField = result.oneofs![0].fields.find(f => f.name === 'new_oneof_val');
            const newRegularField = result.fields.find(f => f.name === 'new_field');

            expect(newOneofField!.number).toBe(6);
            expect(newRegularField!.number).toBe(7);
        });
    });

    describe('multiple errors', () => {
        it('should collect multiple errors', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('field1', 'int32', 1, 'optional'),
                    field('field2', 'string', 2)
                ]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('field1', 'int64', 1),
                    field('field2', 'string', 2, 'repeated')
                ]
            };
            const errors: string[] = [];

            mergeMessage(source, upcoming, errors);

            expect(errors.length).toBeGreaterThanOrEqual(2);
            expect(errors.some(e => e.includes('field1'))).toBe(true);
            expect(errors.some(e => e.includes('field2'))).toBe(true);
        });
    });
});

describe('mergeEnum', () => {
    const enumVal = (name: string, number: number): ProtoEnumValue => ({
        name,
        number
    });

    describe('value preservation', () => {
        it('should preserve values that exist in both', () => {
            const source: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_ACTIVE', 1),
                    enumVal('STATUS_INACTIVE', 2)
                ]
            };
            const upcoming: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_ACTIVE', 1),
                    enumVal('STATUS_INACTIVE', 2)
                ]
            };
            const errors: string[] = [];

            const result = mergeEnum(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            expect(result.values).toHaveLength(3);
        });

        it('should preserve original value numbers from source', () => {
            const source: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_ACTIVE', 1)
                ]
            };
            const upcoming: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_ACTIVE', 3)
                ]
            };
            const errors: string[] = [];

            const result = mergeEnum(source, upcoming, errors);

            expect(result.values[1].number).toBe(1);
        });
    });

    describe('deprecated values', () => {
        it('should deprecate values that exist only in source', () => {
            const source: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_OLD', 1)
                ]
            };
            const upcoming: ProtoEnum = {
                name: 'Status',
                values: [enumVal('STATUS_UNSPECIFIED', 0)]
            };
            const errors: string[] = [];

            const result = mergeEnum(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            expect(result.values).toHaveLength(2);

            const deprecatedValue = result.values.find(v => v.name === 'STATUS_OLD');
            expect(deprecatedValue).toBeDefined();
            expect(deprecatedValue!.options).toContainEqual({ name: 'deprecated', value: 'true' });
        });

        it('should not double-deprecate already deprecated values', () => {
            const source: ProtoEnum = {
                name: 'Status',
                values: [{
                    name: 'STATUS_OLD',
                    number: 1,
                    options: [{ name: 'deprecated', value: 'true' }]
                }]
            };
            const upcoming: ProtoEnum = {
                name: 'Status',
                values: []
            };
            const errors: string[] = [];

            const result = mergeEnum(source, upcoming, errors);

            const deprecatedOptions = result.values[0].options?.filter(
                o => o.name === 'deprecated' && o.value === 'true'
            );
            expect(deprecatedOptions).toHaveLength(1);
        });
    });

    describe('new values', () => {
        it('should add new values with incremented numbers', () => {
            const source: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_ACTIVE', 1)
                ]
            };
            const upcoming: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_ACTIVE', 1),
                    enumVal('STATUS_NEW', 99)
                ]
            };
            const errors: string[] = [];

            const result = mergeEnum(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            expect(result.values).toHaveLength(3);

            const newValue = result.values.find(v => v.name === 'STATUS_NEW');
            expect(newValue).toBeDefined();
            expect(newValue!.number).toBe(2);
        });

        it('should handle multiple new values with sequential numbers', () => {
            const source: ProtoEnum = {
                name: 'Status',
                values: [enumVal('STATUS_UNSPECIFIED', 0)]
            };
            const upcoming: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_NEW1', 10),
                    enumVal('STATUS_NEW2', 20)
                ]
            };
            const errors: string[] = [];

            const result = mergeEnum(source, upcoming, errors);

            expect(result.values).toHaveLength(3);
            const new1 = result.values.find(v => v.name === 'STATUS_NEW1');
            const new2 = result.values.find(v => v.name === 'STATUS_NEW2');
            expect(new1!.number).toBe(1);
            expect(new2!.number).toBe(2);
        });
    });

    describe('complex scenarios', () => {
        it('should handle deprecation and new values together', () => {
            const source: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_OLD', 1),
                    enumVal('STATUS_ACTIVE', 2)
                ]
            };
            const upcoming: ProtoEnum = {
                name: 'Status',
                values: [
                    enumVal('STATUS_UNSPECIFIED', 0),
                    enumVal('STATUS_ACTIVE', 2),
                    enumVal('STATUS_NEW', 99)
                ]
            };
            const errors: string[] = [];

            const result = mergeEnum(source, upcoming, errors);

            expect(errors).toHaveLength(0);
            expect(result.values).toHaveLength(4);

            // Old value deprecated
            const oldValue = result.values.find(v => v.name === 'STATUS_OLD');
            expect(oldValue!.options).toContainEqual({ name: 'deprecated', value: 'true' });
            expect(oldValue!.number).toBe(1);

            // New value added
            const newValue = result.values.find(v => v.name === 'STATUS_NEW');
            expect(newValue!.number).toBe(3);
        });
    });
});
