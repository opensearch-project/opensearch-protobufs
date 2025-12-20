import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    CompatibilityReporter,
    formatField,
    FieldChange,
    EnumValueChange
} from '../../src/postprocessing/CompatibilityReporter';

describe('formatField', () => {
    it('should format field without modifier', () => {
        expect(formatField({ name: 'id', type: 'int32' })).toBe('int32 id');
    });

    it('should format field with optional modifier', () => {
        expect(formatField({ name: 'name', type: 'string', modifier: 'optional' })).toBe('optional string name');
    });

    it('should format field with repeated modifier', () => {
        expect(formatField({ name: 'items', type: 'Item', modifier: 'repeated' })).toBe('repeated Item items');
    });
});

describe('CompatibilityReporter', () => {
    let reporter: CompatibilityReporter;

    beforeEach(() => {
        reporter = new CompatibilityReporter();
    });

    describe('hasChanges', () => {
        it('should return false when no changes', () => {
            expect(reporter.hasChanges()).toBe(false);
        });

        it('should return true when field changes exist', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'ADDED',
                fieldName: 'newField',
                incomingType: 'string newField'
            });
            expect(reporter.hasChanges()).toBe(true);
        });

        it('should return true when enum changes exist', () => {
            reporter.addEnumChange({
                enumName: 'Status',
                changeType: 'ADDED',
                valueName: 'NEW_VALUE'
            });
            expect(reporter.hasChanges()).toBe(true);
        });
    });

    describe('hasIncompatibleChanges', () => {
        it('should return false when no changes', () => {
            expect(reporter.hasIncompatibleChanges()).toBe(false);
        });

        it('should return false for added changes', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'ADDED',
                fieldName: 'field',
                incomingType: 'string field'
            });
            expect(reporter.hasIncompatibleChanges()).toBe(false);
        });

        it('should return false for removed changes', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'REMOVED',
                fieldName: 'field',
                existingType: 'string field'
            });
            expect(reporter.hasIncompatibleChanges()).toBe(false);
        });

        it('should return false for type_changed', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'TYPE CHANGED',
                fieldName: 'field',
                existingType: 'string field',
                incomingType: 'int32 field',
                versionedName: 'field_1'
            });
            expect(reporter.hasIncompatibleChanges()).toBe(false);
        });

        it('should return true for optional_change', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'OPTIONAL CHANGE',
                fieldName: 'field',
                existingType: 'string field',
                incomingType: 'optional string field'
            });
            expect(reporter.hasIncompatibleChanges()).toBe(true);
        });

        it('should return true for oneof_change', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'ONEOF CHANGE',
                fieldName: '*',
                existingLocation: 'has oneof',
                incomingLocation: 'no oneof'
            });
            expect(reporter.hasIncompatibleChanges()).toBe(true);
        });
    });

    describe('getIncompatibleChanges', () => {
        it('should return only incompatible changes', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'ADDED',
                fieldName: 'field1',
                incomingType: 'string field1'
            });
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'OPTIONAL CHANGE',
                fieldName: 'field2',
                existingType: 'string field2',
                incomingType: 'optional string field2'
            });
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'ONEOF CHANGE',
                fieldName: '*',
                existingLocation: 'regular',
                incomingLocation: 'data'
            });

            const incompatible = reporter.getIncompatibleChanges();
            expect(incompatible).toHaveLength(2);
            expect(incompatible[0].changeType).toBe('OPTIONAL CHANGE');
            expect(incompatible[1].changeType).toBe('ONEOF CHANGE');
        });
    });

    describe('getFieldChanges / getEnumChanges', () => {
        it('should return all field changes', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'ADDED',
                fieldName: 'field1',
                incomingType: 'string field1'
            });
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'REMOVED',
                fieldName: 'field2',
                existingType: 'int32 field2'
            });

            expect(reporter.getFieldChanges()).toHaveLength(2);
        });

        it('should return all enum changes', () => {
            reporter.addEnumChange({
                enumName: 'Status',
                changeType: 'ADDED',
                valueName: 'NEW'
            });
            reporter.addEnumChange({
                enumName: 'Status',
                changeType: 'REMOVED',
                valueName: 'OLD'
            });

            expect(reporter.getEnumChanges()).toHaveLength(2);
        });
    });

    describe('clear', () => {
        it('should clear all changes', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'ADDED',
                fieldName: 'field',
                incomingType: 'string field'
            });
            reporter.addEnumChange({
                enumName: 'Status',
                changeType: 'ADDED',
                valueName: 'NEW'
            });

            expect(reporter.hasChanges()).toBe(true);

            reporter.clear();

            expect(reporter.hasChanges()).toBe(false);
            expect(reporter.getFieldChanges()).toHaveLength(0);
            expect(reporter.getEnumChanges()).toHaveLength(0);
        });
    });

    describe('toMarkdown', () => {
        it('should return no changes message when empty', () => {
            const md = reporter.toMarkdown();
            expect(md).toContain('No changes detected');
        });

        it('should format added field change', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'ADDED',
                fieldName: 'newField',
                incomingType: 'string newField'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('## Merge Report');
            expect(md).toContain('### Message Changes');
            expect(md).toContain('#### TestMessage');
            expect(md).toContain('newField');
            expect(md).toContain('**ADDED**');
            expect(md).toContain('New field:');
        });

        it('should format removed field change', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'REMOVED',
                fieldName: 'oldField',
                existingType: 'int32 oldField'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('**REMOVED**');
            expect(md).toContain('Deprecated:');
        });

        it('should format type_changed field', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'TYPE CHANGED',
                fieldName: 'field',
                existingType: 'string field',
                incomingType: 'int32 field',
                versionedName: 'field_1'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('**TYPE CHANGED**');
            expect(md).toContain('versioned as');
            expect(md).toContain('field_1');
        });

        it('should format optional_change with breaking warning', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'OPTIONAL CHANGE',
                fieldName: 'field',
                existingType: 'string field',
                incomingType: 'optional string field'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('**OPTIONAL CHANGE**');
            expect(md).toContain('⚠️ Breaking');
        });

        it('should format oneof_change with breaking warning', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'ONEOF CHANGE',
                fieldName: '*',
                existingLocation: 'has oneof',
                incomingLocation: 'no oneof'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('**ONEOF CHANGE**');
            expect(md).toContain('⚠️ Breaking');
            expect(md).toContain('moved from');
        });

        it('should format enum changes', () => {
            reporter.addEnumChange({
                enumName: 'Status',
                changeType: 'ADDED',
                valueName: 'PENDING'
            });
            reporter.addEnumChange({
                enumName: 'Status',
                changeType: 'REMOVED',
                valueName: 'OBSOLETE'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('### Enum Changes');
            expect(md).toContain('#### Status');
            expect(md).toContain('PENDING');
            expect(md).toContain('**ADDED**');
            expect(md).toContain('OBSOLETE');
            expect(md).toContain('**REMOVED**');
        });

        it('should group changes by message name', () => {
            reporter.addFieldChange({
                messageName: 'MessageA',
                changeType: 'ADDED',
                fieldName: 'field1',
                incomingType: 'string field1'
            });
            reporter.addFieldChange({
                messageName: 'MessageB',
                changeType: 'ADDED',
                fieldName: 'field2',
                incomingType: 'int32 field2'
            });
            reporter.addFieldChange({
                messageName: 'MessageA',
                changeType: 'REMOVED',
                fieldName: 'field3',
                existingType: 'bool field3'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('#### MessageA');
            expect(md).toContain('#### MessageB');
            // MessageA should have 2 entries
            const messageASection = md.split('#### MessageA')[1].split('#### MessageB')[0];
            expect(messageASection).toContain('field1');
            expect(messageASection).toContain('field3');
        });
    });
});
