/**
 * Tests for the merger module.
 */

import { mergeMessage, mergeEnum } from '../../src/postprocessing/CompatibilityMerger';
import { CompatibilityReporter } from '../../src/postprocessing/CompatibilityReporter';
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

            const result = mergeMessage(source, upcoming);

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

            const result = mergeMessage(source, upcoming);

            // Source field numbers should be preserved
            expect(result.fields[0].number).toBe(1);
            expect(result.fields[1].number).toBe(2);
        });
    });

    describe('optional changes (breaking, no versioning)', () => {
        it('should report when optional is added (no versioning, just update)', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1, 'optional')]
            };
            const reporter = new CompatibilityReporter();

            const result = mergeMessage(source, upcoming, reporter);

            // Optional change is reported as optional_change (incompatible)
            const optionalChanges = reporter.getFieldChanges().filter(c => c.changeType === 'OPTIONAL CHANGE');
            expect(optionalChanges).toHaveLength(1);
            expect(reporter.hasIncompatibleChanges()).toBe(true);
            expect(result.fields).toHaveLength(1);
            expect(result.fields[0].name).toBe('id');
            expect(result.fields[0].modifier).toBe('optional');
            expect(result.fields[0].number).toBe(1);
        });

        it('should report when optional is removed (no versioning, just update)', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1, 'optional')]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1)]
            };
            const reporter = new CompatibilityReporter();

            const result = mergeMessage(source, upcoming, reporter);

            // Optional change is reported as optional_change (incompatible)
            const optionalChanges = reporter.getFieldChanges().filter(c => c.changeType === 'OPTIONAL CHANGE');
            expect(optionalChanges).toHaveLength(1);
            expect(reporter.hasIncompatibleChanges()).toBe(true);

            expect(result.fields).toHaveLength(1);
            expect(result.fields[0].name).toBe('id');
            expect(result.fields[0].modifier).toBeUndefined();
            expect(result.fields[0].number).toBe(1);
        });
    });

    describe('repeated changes (handled gracefully)', () => {
        it('should handle repeated added gracefully', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('items', 'string', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('items', 'string', 1, 'repeated')]
            };

            const result = mergeMessage(source, upcoming);

            expect(result.fields).toHaveLength(2);
            // Old field deprecated
            expect(result.fields[0].name).toBe('items');
            expect(result.fields[0].modifier).toBeUndefined();
            expect(result.fields[0].annotations).toContainEqual({ name: 'deprecated', value: 'true' });
            // New field with repeated
            expect(result.fields[1].name).toBe('items_2');
            expect(result.fields[1].modifier).toBe('repeated');
        });

        it('should handle repeated removed gracefully', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('items', 'string', 1, 'repeated')]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('items', 'string', 1)]
            };

            const result = mergeMessage(source, upcoming);

            expect(result.fields).toHaveLength(2);
            // Old field deprecated
            expect(result.fields[0].name).toBe('items');
            expect(result.fields[0].modifier).toBe('repeated');
            expect(result.fields[0].annotations).toContainEqual({ name: 'deprecated', value: 'true' });
            // New field without repeated
            expect(result.fields[1].name).toBe('items_2');
            expect(result.fields[1].modifier).toBeUndefined();
        });
    });

    describe('type changes (handled gracefully)', () => {
        it('should deprecate old field and add new field when type changes', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int32', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('id', 'int64', 1)]
            };

            const result = mergeMessage(source, upcoming);

            expect(result.fields).toHaveLength(2);
            // Old field should be deprecated
            expect(result.fields[0].name).toBe('id');
            expect(result.fields[0].type).toBe('int32');
            expect(result.fields[0].annotations).toContainEqual({ name: 'deprecated', value: 'true' });
            // New field with updated type (version 2)
            expect(result.fields[1].name).toBe('id_2');
            expect(result.fields[1].type).toBe('int64');
            expect(result.fields[1].number).toBe(2);
        });

        it('should handle message type changes gracefully', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('data', 'OldType', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('data', 'NewType', 1)]
            };

            const result = mergeMessage(source, upcoming);

            expect(result.fields).toHaveLength(2);
            // Old field deprecated
            expect(result.fields[0].name).toBe('data');
            expect(result.fields[0].type).toBe('OldType');
            expect(result.fields[0].annotations).toContainEqual({ name: 'deprecated', value: 'true' });
            // New field (version 2)
            expect(result.fields[1].name).toBe('data_2');
            expect(result.fields[1].type).toBe('NewType');
        });

        it('should preserve comment on versioned field when type changes', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [{
                    name: 'data',
                    type: 'string',
                    number: 1,
                    comment: 'This is a field description'
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('data', 'int32', 1)]
            };

            const result = mergeMessage(source, upcoming);

            // New versioned field should have the source comment
            const versionedField = result.fields.find(f => f.name === 'data_2');
            expect(versionedField).toBeDefined();
            expect(versionedField!.comment).toBe('This is a field description');
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

            const result = mergeMessage(source, upcoming);

            expect(result.fields).toHaveLength(2);

            const deprecatedField = result.fields.find(f => f.name === 'old_field');
            expect(deprecatedField).toBeDefined();
            expect(deprecatedField!.annotations).toContainEqual({ name: 'deprecated', value: 'true' });
        });

        it('should not double-deprecate already deprecated fields', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [{
                    name: 'old_field',
                    type: 'string',
                    number: 1,
                    annotations: [{ name: 'deprecated', value: 'true' }]
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: []
            };

            const result = mergeMessage(source, upcoming);

            const deprecatedField = result.fields[0];
            const deprecatedOptions = deprecatedField.annotations?.filter(
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

            const result = mergeMessage(source, upcoming);

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

            const result = mergeMessage(source, upcoming);

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

            const result = mergeMessage(source, upcoming);

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

            const result = mergeMessage(source, upcoming);

            const removedField = result.oneofs![0].fields.find(f => f.name === 'removed_val');
            expect(removedField).toBeDefined();
            expect(removedField!.annotations).toContainEqual({ name: 'deprecated', value: 'true' });
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

            const result = mergeMessage(source, upcoming);

            expect(result.oneofs![0].fields).toHaveLength(2);

            const newField = result.oneofs![0].fields.find(f => f.name === 'new_val');
            expect(newField).toBeDefined();
            expect(newField!.number).toBe(2);
            expect(newField!.type).toBe('double');
        });

        it('should handle type change in oneof field gracefully', () => {
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

            const result = mergeMessage(source, upcoming);

            expect(result.oneofs![0].fields).toHaveLength(2);
            // Old field deprecated
            expect(result.oneofs![0].fields[0].name).toBe('val');
            expect(result.oneofs![0].fields[0].type).toBe('string');
            expect(result.oneofs![0].fields[0].annotations).toContainEqual({ name: 'deprecated', value: 'true' });
            // New field with updated type (version 2)
            expect(result.oneofs![0].fields[1].name).toBe('val_2');
            expect(result.oneofs![0].fields[1].type).toBe('bytes');
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

            const result = mergeMessage(source, upcoming);

            const newOneofField = result.oneofs![0].fields.find(f => f.name === 'new_oneof_val');
            const newRegularField = result.fields.find(f => f.name === 'new_field');

            // Regular fields processed first, then oneofs
            expect(newRegularField!.number).toBe(6);
            expect(newOneofField!.number).toBe(7);
        });
    });

    describe('oneof structure changes (breaking)', () => {
        it('should report when oneof is added', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('value', 'string', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'data',
                    fields: [field('value', 'string', 1)]
                }]
            };
            const reporter = new CompatibilityReporter();

            mergeMessage(source, upcoming, reporter);

            const oneofChanges = reporter.getFieldChanges().filter(c => c.changeType === 'ONEOF CHANGE');
            expect(oneofChanges).toHaveLength(1);
            expect(oneofChanges[0].existingLocation).toBe('no oneof');
            expect(oneofChanges[0].incomingLocation).toBe('has oneof');
            expect(reporter.hasIncompatibleChanges()).toBe(true);
        });

        it('should report when oneof is removed', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'data',
                    fields: [field('value', 'string', 1)]
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('value', 'string', 1)]
            };
            const reporter = new CompatibilityReporter();

            mergeMessage(source, upcoming, reporter);

            const oneofChanges = reporter.getFieldChanges().filter(c => c.changeType === 'ONEOF CHANGE');
            expect(oneofChanges).toHaveLength(1);
            expect(oneofChanges[0].existingLocation).toBe('has oneof');
            expect(oneofChanges[0].incomingLocation).toBe('no oneof');
            expect(reporter.hasIncompatibleChanges()).toBe(true);
        });

        it('should not report when both have oneof', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'data',
                    fields: [field('value', 'string', 1)]
                }]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [],
                oneofs: [{
                    name: 'data',
                    fields: [field('value', 'string', 1)]
                }]
            };
            const reporter = new CompatibilityReporter();

            mergeMessage(source, upcoming, reporter);

            const oneofChanges = reporter.getFieldChanges().filter(c => c.changeType === 'ONEOF CHANGE');
            expect(oneofChanges).toHaveLength(0);
            expect(reporter.hasIncompatibleChanges()).toBe(false);
        });

        it('should not report when neither has oneof', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('value', 'string', 1)]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('value', 'string', 1)]
            };
            const reporter = new CompatibilityReporter();

            mergeMessage(source, upcoming, reporter);

            const oneofChanges = reporter.getFieldChanges().filter(c => c.changeType === 'ONEOF CHANGE');
            expect(oneofChanges).toHaveLength(0);
            expect(reporter.hasIncompatibleChanges()).toBe(false);
        });
    });

    describe('multiple changes', () => {
        it('should handle multiple type/repeated changes gracefully', () => {
            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('field1', 'int32', 1),
                    field('field2', 'string', 2)
                ]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    field('field1', 'int64', 1),              // type change
                    field('field2', 'string', 2, 'repeated')  // repeated added
                ]
            };

            const result = mergeMessage(source, upcoming);

            // 2 original fields deprecated + 2 new versioned fields = 4 total
            expect(result.fields).toHaveLength(4);

            // New fields are added at the end
            // Order: field1 [deprecated], field2 [deprecated], field1_2, field2_2
            expect(result.fields[0].name).toBe('field1');
            expect(result.fields[0].annotations).toContainEqual({ name: 'deprecated', value: 'true' });

            expect(result.fields[1].name).toBe('field2');
            expect(result.fields[1].annotations).toContainEqual({ name: 'deprecated', value: 'true' });

            expect(result.fields[2].name).toBe('field1_2');
            expect(result.fields[2].type).toBe('int64');

            expect(result.fields[3].name).toBe('field2_2');
            expect(result.fields[3].modifier).toBe('repeated');
        });

        it('should handle versioned field with deprecated predecessor and type change', () => {
            // Source has:
            //   bool test_name = 1 [deprecated = true]   <- already deprecated
            //   string test_name_2 = 2                   <- active versioned field
            // Upcoming has:
            //   int32 test_name = 1                      <- type changed again
            // Expected:
            //   bool test_name = 1 [deprecated = true]   <- kept as-is
            //   string test_name_2 = 2 [deprecated = true] <- deprecated (type mismatch)
            //   int32 test_name_3 = 3                    <- new version

            const source: ProtoMessage = {
                name: 'TestMessage',
                fields: [
                    {
                        name: 'test_name',
                        type: 'bool',
                        number: 1,
                        annotations: [{ name: 'deprecated', value: 'true' }]
                    },
                    field('test_name_2', 'string', 2)
                ]
            };
            const upcoming: ProtoMessage = {
                name: 'TestMessage',
                fields: [field('test_name', 'int32', 1)]
            };

            const result = mergeMessage(source, upcoming);

            expect(result.fields).toHaveLength(3);

            // First field: kept as-is (already deprecated)
            expect(result.fields[0].name).toBe('test_name');
            expect(result.fields[0].type).toBe('bool');
            expect(result.fields[0].number).toBe(1);
            expect(result.fields[0].annotations).toContainEqual({ name: 'deprecated', value: 'true' });

            // Second field: deprecated because type doesn't match upcoming
            expect(result.fields[1].name).toBe('test_name_2');
            expect(result.fields[1].type).toBe('string');
            expect(result.fields[1].number).toBe(2);
            expect(result.fields[1].annotations).toContainEqual({ name: 'deprecated', value: 'true' });

            // Third field: new versioned field
            expect(result.fields[2].name).toBe('test_name_3');
            expect(result.fields[2].type).toBe('int32');
            expect(result.fields[2].number).toBe(3);
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

            const result = mergeEnum(source, upcoming);

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

            const result = mergeEnum(source, upcoming);

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

            const result = mergeEnum(source, upcoming);

            expect(result.values).toHaveLength(2);

            const deprecatedValue = result.values.find(v => v.name === 'STATUS_OLD');
            expect(deprecatedValue).toBeDefined();
            expect(deprecatedValue!.annotations).toContainEqual({ name: 'deprecated', value: 'true' });
        });

        it('should not double-deprecate already deprecated values', () => {
            const source: ProtoEnum = {
                name: 'Status',
                values: [{
                    name: 'STATUS_OLD',
                    number: 1,
                    annotations: [{ name: 'deprecated', value: 'true' }]
                }]
            };
            const upcoming: ProtoEnum = {
                name: 'Status',
                values: []
            };

            const result = mergeEnum(source, upcoming);

            const deprecatedOptions = result.values[0].annotations?.filter(
                o => o.name === 'deprecated' && o.value === 'true'
            );
            expect(deprecatedOptions).toHaveLength(1);
        });

        it('should not report already deprecated values', () => {
            const source: ProtoEnum = {
                name: 'Status',
                values: [{
                    name: 'STATUS_OLD',
                    number: 1,
                    annotations: [{ name: 'deprecated', value: 'true' }]
                }]
            };
            const upcoming: ProtoEnum = {
                name: 'Status',
                values: []
            };

            const reporter = new CompatibilityReporter();
            mergeEnum(source, upcoming, reporter);

            // Reporter should have no enum changes since value was already deprecated
            const markdown = reporter.toMarkdown();
            expect(markdown).toContain('No changes detected');
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

            const result = mergeEnum(source, upcoming);

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

            const result = mergeEnum(source, upcoming);

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

            const result = mergeEnum(source, upcoming);

            expect(result.values).toHaveLength(4);

            // Old value deprecated
            const oldValue = result.values.find(v => v.name === 'STATUS_OLD');
            expect(oldValue!.annotations).toContainEqual({ name: 'deprecated', value: 'true' });
            expect(oldValue!.number).toBe(1);

            // New value added
            const newValue = result.values.find(v => v.name === 'STATUS_NEW');
            expect(newValue!.number).toBe(3);
        });
    });
});
