/**
 * Tests for the writer module.
 * Verifies proto generation from internal types.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    generateMessage,
    generateEnum,
    writeProtoFile,
    CUSTOM_MESSAGE_NAMES,
    CUSTOM_ENUM_NAMES
} from '../../src/postprocessing/writer';
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
                    annotations: [{ name: 'deprecated', value: 'true' }]
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

    it('should generate message with oneof field annotations', () => {
        const msg: ProtoMessage = {
            name: 'WithOneofAnnotations',
            fields: [],
            oneofs: [{
                name: 'value',
                fields: [
                    { name: 'old_value', type: 'string', number: 1, annotations: [{ name: 'deprecated', value: 'true' }] },
                    { name: 'new_value', type: 'int32', number: 2 }
                ]
            }]
        };

        const output = generateMessage(msg);

        expect(output).toContain('oneof value {');
        expect(output).toContain('string old_value = 1 [deprecated = true];');
        expect(output).toContain('int32 new_value = 2;');
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
                    annotations: [{ name: 'deprecated', value: 'true' }]
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

describe('writeProtoFile', () => {
    let tempDir: string;
    let outputPath: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-test-'));
        outputPath = path.join(tempDir, 'output.proto');
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    it('should write proto file with header', () => {
        const messages: ProtoMessage[] = [];
        const enums: ProtoEnum[] = [];

        writeProtoFile(messages, enums, outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);

        const content = fs.readFileSync(outputPath, 'utf-8');
        expect(content).toContain('syntax = "proto3"');
        expect(content).toContain('package org.opensearch.protobufs');
    });

    it('should write messages to file', () => {
        const messages: ProtoMessage[] = [
            {
                name: 'TestMessage',
                fields: [{ name: 'id', type: 'int32', number: 1 }]
            }
        ];

        writeProtoFile(messages, [], outputPath);

        const content = fs.readFileSync(outputPath, 'utf-8');
        expect(content).toContain('message TestMessage');
        expect(content).toContain('int32 id = 1');
    });

    it('should write enums to file', () => {
        const enums: ProtoEnum[] = [
            {
                name: 'TestEnum',
                values: [{ name: 'TEST_UNSPECIFIED', number: 0 }]
            }
        ];

        writeProtoFile([], enums, outputPath);

        const content = fs.readFileSync(outputPath, 'utf-8');
        expect(content).toContain('enum TestEnum');
        expect(content).toContain('TEST_UNSPECIFIED = 0');
    });

    it('should exclude custom message names (ObjectMap, GeneralNumber)', () => {
        const messages: ProtoMessage[] = [
            { name: 'ObjectMap', fields: [] },
            { name: 'GeneralNumber', fields: [] },
            { name: 'RegularMessage', fields: [{ name: 'data', type: 'string', number: 1 }] }
        ];

        writeProtoFile(messages, [], outputPath);

        const content = fs.readFileSync(outputPath, 'utf-8');

        // Should contain regular message
        expect(content).toContain('message RegularMessage');

        // Custom messages are excluded from generation (added from template at end)
        // The template version of ObjectMap should be present
        expect(content).toContain('ObjectMap');
    });

    it('should exclude custom enum names (NullValue)', () => {
        const enums: ProtoEnum[] = [
            { name: 'NullValue', values: [{ name: 'NULL_VALUE', number: 0 }] },
            { name: 'RegularEnum', values: [{ name: 'REGULAR_UNSPECIFIED', number: 0 }] }
        ];

        writeProtoFile([], enums, outputPath);

        const content = fs.readFileSync(outputPath, 'utf-8');

        // Should contain regular enum
        expect(content).toContain('enum RegularEnum');

        // NullValue should come from template
        expect(content).toContain('NullValue');
    });

    it('should append custom messages from template', () => {
        writeProtoFile([], [], outputPath);

        const content = fs.readFileSync(outputPath, 'utf-8');

        // Custom messages from template should be present
        expect(content).toContain('ObjectMap');
        expect(content).toContain('GeneralNumber');
        expect(content).toContain('NullValue');
    });

    it('should write multiple messages and enums', () => {
        const messages: ProtoMessage[] = [
            { name: 'Message1', fields: [{ name: 'a', type: 'string', number: 1 }] },
            { name: 'Message2', fields: [{ name: 'b', type: 'int32', number: 1 }] }
        ];
        const enums: ProtoEnum[] = [
            { name: 'Enum1', values: [{ name: 'E1_UNSPECIFIED', number: 0 }] },
            { name: 'Enum2', values: [{ name: 'E2_UNSPECIFIED', number: 0 }] }
        ];

        writeProtoFile(messages, enums, outputPath);

        const content = fs.readFileSync(outputPath, 'utf-8');
        expect(content).toContain('message Message1');
        expect(content).toContain('message Message2');
        expect(content).toContain('enum Enum1');
        expect(content).toContain('enum Enum2');
    });
});

describe('CUSTOM_MESSAGE_NAMES', () => {
    it('should contain ObjectMap', () => {
        expect(CUSTOM_MESSAGE_NAMES.has('ObjectMap')).toBe(true);
    });

    it('should contain GeneralNumber', () => {
        expect(CUSTOM_MESSAGE_NAMES.has('GeneralNumber')).toBe(true);
    });

    it('should not contain regular message names', () => {
        expect(CUSTOM_MESSAGE_NAMES.has('SearchRequest')).toBe(false);
        expect(CUSTOM_MESSAGE_NAMES.has('RegularMessage')).toBe(false);
    });
});

describe('CUSTOM_ENUM_NAMES', () => {
    it('should contain NullValue', () => {
        expect(CUSTOM_ENUM_NAMES.has('NullValue')).toBe(true);
    });

    it('should not contain regular enum names', () => {
        expect(CUSTOM_ENUM_NAMES.has('SortOrder')).toBe(false);
        expect(CUSTOM_ENUM_NAMES.has('Status')).toBe(false);
    });
});
