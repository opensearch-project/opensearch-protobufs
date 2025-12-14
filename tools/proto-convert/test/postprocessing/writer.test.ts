/**
 * Tests for the writer module.
 * Verifies proto generation from internal types.
 */

import { generateMessage, generateEnum } from '../../src/postprocessing/writer';
import { ProtoMessage, ProtoEnum } from '../../src/postprocessing/types';

describe('generateMessage', () => {
    it('should generate a simple message', () => {
        const msg: ProtoMessage = {
            name: 'SimpleMessage',
            fields: [
                { name: 'id', type: 'int32', number: 1 },
                { name: 'name', type: 'string', number: 2 }
            ]
        };

        const output = generateMessage(msg);

        expect(output).toContain('message SimpleMessage {');
        expect(output).toContain('int32 id = 1;');
        expect(output).toContain('string name = 2;');
        expect(output).toContain('}');
    });

    it('should generate message with modifiers', () => {
        const msg: ProtoMessage = {
            name: 'WithModifiers',
            fields: [
                { name: 'id', type: 'int32', number: 1 },
                { name: 'description', type: 'string', number: 2, modifier: 'optional' },
                { name: 'tags', type: 'string', number: 3, modifier: 'repeated' }
            ]
        };

        const output = generateMessage(msg);

        expect(output).toContain('int32 id = 1;');
        expect(output).toContain('optional string description = 2;');
        expect(output).toContain('repeated string tags = 3;');
    });

    it('should generate message with options', () => {
        const msg: ProtoMessage = {
            name: 'WithOptions',
            fields: [
                {
                    name: 'old_field',
                    type: 'string',
                    number: 1,
                    options: [{ name: 'deprecated', value: 'true' }]
                }
            ]
        };

        const output = generateMessage(msg);

        expect(output).toContain('string old_field = 1 [deprecated = true];');
    });

    it('should generate message with oneof', () => {
        const msg: ProtoMessage = {
            name: 'WithOneof',
            fields: [{ name: 'id', type: 'int32', number: 1 }],
            oneofs: [{
                name: 'value',
                fields: [
                    { name: 'str_val', type: 'string', number: 2 },
                    { name: 'int_val', type: 'int32', number: 3 }
                ]
            }]
        };

        const output = generateMessage(msg);

        expect(output).toContain('int32 id = 1;');
        expect(output).toContain('oneof value {');
        expect(output).toContain('string str_val = 2;');
        expect(output).toContain('int32 int_val = 3;');
    });

    it('should generate message with comments', () => {
        const msg: ProtoMessage = {
            name: 'WithComments',
            comment: 'Message comment',
            fields: [
                { name: 'id', type: 'int32', number: 1, comment: 'Field comment' }
            ]
        };

        const output = generateMessage(msg);

        expect(output).toContain('// Message comment');
        expect(output).toContain('// Field comment');
    });

    it('should generate message with map type', () => {
        const msg: ProtoMessage = {
            name: 'WithMap',
            fields: [
                { name: 'metadata', type: 'map<string, string>', number: 1 }
            ]
        };

        const output = generateMessage(msg);

        expect(output).toContain('map<string, string> metadata = 1;');
    });
});

describe('generateEnum', () => {
    it('should generate a simple enum', () => {
        const protoEnum: ProtoEnum = {
            name: 'Status',
            values: [
                { name: 'STATUS_UNSPECIFIED', number: 0 },
                { name: 'STATUS_ACTIVE', number: 1 }
            ]
        };

        const output = generateEnum(protoEnum);

        expect(output).toContain('enum Status {');
        expect(output).toContain('STATUS_UNSPECIFIED = 0;');
        expect(output).toContain('STATUS_ACTIVE = 1;');
        expect(output).toContain('}');
    });

    it('should generate enum with options', () => {
        const protoEnum: ProtoEnum = {
            name: 'Status',
            values: [
                { name: 'STATUS_UNSPECIFIED', number: 0 },
                {
                    name: 'STATUS_OLD',
                    number: 1,
                    options: [{ name: 'deprecated', value: 'true' }]
                }
            ]
        };

        const output = generateEnum(protoEnum);

        expect(output).toContain('STATUS_OLD = 1 [deprecated = true];');
    });

    it('should generate enum with comment', () => {
        const protoEnum: ProtoEnum = {
            name: 'Status',
            comment: 'Enum comment',
            values: [
                { name: 'STATUS_UNSPECIFIED', number: 0 }
            ]
        };

        const output = generateEnum(protoEnum);

        expect(output).toContain('// Enum comment');
    });
});
