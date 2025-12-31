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

    it('should format field with field number', () => {
        expect(formatField({ name: 'id', type: 'int32', number: 5 })).toBe('int32 id = 5');
    });

    it('should format field with deprecated annotation', () => {
        expect(formatField({ name: 'old', type: 'string', deprecated: true })).toBe('string old [deprecated = true]');
    });

    it('should format field with all properties', () => {
        expect(formatField({ name: 'field', type: 'string', modifier: 'optional', number: 3, deprecated: true }))
            .toBe('optional string field = 3 [deprecated = true]');
    });
});

describe('CompatibilityReporter', () => {
    let reporter: CompatibilityReporter;

    beforeEach(() => {
        reporter = new CompatibilityReporter();
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
            expect(md).toContain('| Message | Change | Field |');
            expect(md).toContain('➕ **ADDED**');
            expect(md).toContain('`string newField`');
            expect(md).toContain('### Legend');
        });

        it('should format removed field change', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'REMOVED',
                fieldName: 'oldField',
                existingType: 'int32 oldField'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('🗑️ **REMOVED**');
            expect(md).toContain('`int32 oldField`');
        });

        it('should format type_changed as two rows (deprecated + added)', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'TYPE CHANGED',
                fieldName: 'field',
                existingType: 'string field',
                incomingType: 'int32 field',
                versionedName: 'field_1'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('🗑️ **DEPRECATED**');
            expect(md).toContain('`string field`');
            expect(md).toContain('➕ **ADDED**');
            expect(md).toContain('`int32 field_1`');
        });

        it('should show correct versioned number after updateVersionedNumber', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'TYPE CHANGED',
                fieldName: 'boost',
                existingType: 'optional float boost = 5 [deprecated = true]',
                incomingType: 'optional bool boost = 3',  // Wrong number from incoming spec
                versionedName: 'boost_1'
            });

            // Simulate the versioned field getting its real number assigned later
            reporter.updateVersionedNumber('boost_1', 10);

            const md = reporter.toMarkdown();
            expect(md).toContain('`optional float boost = 5 [deprecated = true]`');
            expect(md).toContain('`optional bool boost_1 = 10`');  // Correct number
            expect(md).not.toContain('boost_1 = 3');  // Wrong number should be stripped
        });

        it('should format optional_change with warning icon', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'OPTIONAL CHANGE',
                fieldName: 'field',
                existingType: 'string field',
                incomingType: 'optional string field'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('🚨 **BREAKING**');
            expect(md).toContain('`string field` → `optional string field`');
        });

        it('should format oneof_change with breaking icon', () => {
            reporter.addFieldChange({
                messageName: 'TestMessage',
                changeType: 'ONEOF CHANGE',
                fieldName: '*',
                existingLocation: 'has oneof',
                incomingLocation: 'no oneof'
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('🚨 **BREAKING**');
            expect(md).toContain('moved from');
        });

        it('should format enum changes', () => {
            reporter.addEnumChange({
                enumName: 'Status',
                changeType: 'ADDED',
                valueName: 'NEW_VALUE',
                valueNumber: 5
            });
            reporter.addEnumChange({
                enumName: 'Status',
                changeType: 'DEPRECATED',
                valueName: 'OBSOLETE',
                valueNumber: 2
            });

            const md = reporter.toMarkdown();
            expect(md).toContain('### Enum Changes');
            expect(md).toContain('| Enum | Change | Value |');
            expect(md).toContain('➕ **ADDED**');
            expect(md).toContain('`NEW_VALUE = 5`');
            expect(md).toContain('🗑️ **DEPRECATED**');
            expect(md).toContain('`OBSOLETE = 2 [deprecated = true]`');
        });

        it('should include message name in each row', () => {
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
            expect(md).toContain('| MessageA | ➕ **ADDED** |');
            expect(md).toContain('| MessageB | ➕ **ADDED** |');
            expect(md).toContain('| MessageA | 🗑️ **REMOVED** |');
        });
    });

    describe('writeToFile', () => {
        it('should write report to default temp location', () => {
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'ADDED',
                fieldName: 'field',
                incomingType: 'string field'
            });

            const path = reporter.writeToFile();
            expect(path).toBe(join(tmpdir(), 'merge-report.md'));
            expect(existsSync(path)).toBe(true);

            const content = readFileSync(path, 'utf-8');
            expect(content).toContain('## Merge Report');

            unlinkSync(path);
        });

        it('should write report to custom path', () => {
            const customPath = join(tmpdir(), 'custom-report.md');
            reporter.addFieldChange({
                messageName: 'Test',
                changeType: 'ADDED',
                fieldName: 'field',
                incomingType: 'string field'
            });

            const path = reporter.writeToFile(customPath);
            expect(path).toBe(customPath);
            expect(existsSync(customPath)).toBe(true);

            unlinkSync(customPath);
        });
    });
});
