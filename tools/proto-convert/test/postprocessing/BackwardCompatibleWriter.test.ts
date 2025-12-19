/**
 * Tests for BackwardCompatibleWriter module.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BackwardCompatibleWriter } from '../../src/postprocessing/BackwardCompatibleWriter';
import { BackwardCompatibilityError } from '../../src/postprocessing/types';
import { parseProtoFile } from '../../src/postprocessing/parser';

const FIXTURES_DIR = path.join(__dirname, '../fixtures/proto');
const EXISTING_PROTO = path.join(FIXTURES_DIR, 'existing.proto');
const INCOMING_PROTO = path.join(FIXTURES_DIR, 'incoming.proto');

// Proto content for error handling tests
const PROTO_OPTIONAL_ADDED = `
syntax = "proto3";
package test;

message SearchRequest {
  optional string query = 1;
  int32 limit = 2;
}
`;

const PROTO_TYPE_CHANGE = `
syntax = "proto3";
package test;

message SearchRequest {
  int32 query = 1;
  int32 limit = 2;
}
`;

const PROTO_CUSTOM_MESSAGES = `
syntax = "proto3";
package test;

message ObjectMap {
  string data = 1;
}

message GeneralNumber {
  double value = 1;
}

message RegularMessage {
  string field = 1;
}
`;

describe('BackwardCompatibleWriter', () => {
    let tempDir: string;
    let outputPath: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backward-compat-test-'));
        outputPath = path.join(tempDir, 'output.proto');
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    describe('constructor', () => {
        it('should parse existing and incoming proto files', () => {
            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                [INCOMING_PROTO],
                outputPath
            );

            // Writer should be created without errors
            expect(writer).toBeDefined();
        });

        it('should handle non-existent incoming files gracefully', () => {
            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                ['/non/existent/path.proto'],
                outputPath
            );

            expect(writer).toBeDefined();
        });

        it('should handle multiple incoming files', () => {
            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                [INCOMING_PROTO, INCOMING_PROTO],
                outputPath
            );

            expect(writer).toBeDefined();
        });
    });

    describe('process', () => {
        it('should merge existing and incoming messages', () => {
            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                [INCOMING_PROTO],
                outputPath
            );

            writer.process();

            expect(fs.existsSync(outputPath)).toBe(true);

            const output = parseProtoFile(outputPath);
            const messageNames = output.messages.map(m => m.name);

            // Should contain merged message
            expect(messageNames).toContain('SearchRequest');

            // Should preserve existing-only messages
            expect(messageNames).toContain('LegacyMessage');

            // Should add new incoming messages
            expect(messageNames).toContain('NewMessage');
        });

        it('should merge existing and incoming enums', () => {
            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                [INCOMING_PROTO],
                outputPath
            );

            writer.process();

            const output = parseProtoFile(outputPath);
            const enumNames = output.enums.map(e => e.name);

            // Should contain merged enum
            expect(enumNames).toContain('SortOrder');

            // Should preserve existing-only enums
            expect(enumNames).toContain('LegacyEnum');

            // Should add new incoming enums
            expect(enumNames).toContain('NewEnum');
        });

        it('should add new fields from incoming to existing messages', () => {
            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                [INCOMING_PROTO],
                outputPath
            );

            writer.process();

            const output = parseProtoFile(outputPath);
            const searchRequest = output.messages.find(m => m.name === 'SearchRequest');

            expect(searchRequest).toBeDefined();
            const fieldNames = searchRequest!.fields.map(f => f.name);

            // Should have original fields
            expect(fieldNames).toContain('query');
            expect(fieldNames).toContain('limit');

            // Should have new field from incoming
            expect(fieldNames).toContain('fuzzy');
        });

        it('should add new enum values from incoming', () => {
            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                [INCOMING_PROTO],
                outputPath
            );

            writer.process();

            const output = parseProtoFile(outputPath);
            const sortOrder = output.enums.find(e => e.name === 'SortOrder');

            expect(sortOrder).toBeDefined();
            const valueNames = sortOrder!.values.map(v => v.name);

            // Should have original values
            expect(valueNames).toContain('SORT_ORDER_UNSPECIFIED');
            expect(valueNames).toContain('SORT_ORDER_ASC');
            expect(valueNames).toContain('SORT_ORDER_DESC');

            // Should have new value from incoming
            expect(valueNames).toContain('SORT_ORDER_RELEVANCE');
        });

        it('should write to output file', () => {
            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                [INCOMING_PROTO],
                outputPath
            );

            writer.process();

            expect(fs.existsSync(outputPath)).toBe(true);

            const content = fs.readFileSync(outputPath, 'utf-8');
            expect(content).toContain('syntax = "proto3"');
            expect(content).toContain('message SearchRequest');
        });
    });

    describe('error handling', () => {
        it('should throw BackwardCompatibilityError on optional change (added)', () => {
            const badIncoming = path.join(tempDir, 'bad_incoming.proto');
            fs.writeFileSync(badIncoming, PROTO_OPTIONAL_ADDED);

            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                [badIncoming],
                outputPath
            );

            expect(() => writer.process()).toThrow(BackwardCompatibilityError);
        });

        it('should handle type change by deprecating old field', () => {
            const typeChangeProto = path.join(tempDir, 'type_change.proto');
            fs.writeFileSync(typeChangeProto, PROTO_TYPE_CHANGE);

            const writer = new BackwardCompatibleWriter(
                EXISTING_PROTO,
                [typeChangeProto],
                outputPath
            );

            // Should not throw - type changes are handled by deprecation
            writer.process();

            const output = parseProtoFile(outputPath);
            const searchRequest = output.messages.find(m => m.name === 'SearchRequest');
            const queryField = searchRequest?.fields.find(f => f.name === 'query');

            // Original field should be deprecated
            expect(queryField?.annotations).toContainEqual({ name: 'deprecated', value: 'true' });
        });
    });

    describe('custom messages handling', () => {
        it('should skip ObjectMap and GeneralNumber custom messages', () => {
            const existingWithCustom = path.join(tempDir, 'existing_custom.proto');
            fs.writeFileSync(existingWithCustom, PROTO_CUSTOM_MESSAGES);

            const writer = new BackwardCompatibleWriter(
                existingWithCustom,
                [],
                outputPath
            );

            writer.process();

            const content = fs.readFileSync(outputPath, 'utf-8');
            // Custom messages should come from template, not from parsing
            expect(content).toContain('RegularMessage');
        });
    });
});
