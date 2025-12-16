/**
 * Tests for the parser module.
 * Verifies proto files are correctly parsed into internal types.
 */

import * as path from 'path';
import { parseProtoFile } from '../../src/postprocessing/parser';

const TEST_PROTO = path.join(__dirname, '../fixtures/proto/test.proto');

describe('parseProtoFile', () => {
    const result = parseProtoFile(TEST_PROTO);

    it('should parse messages into ProtoMessage[]', () => {
        expect(Array.isArray(result.messages)).toBe(true);
        expect(result.messages.length).toBeGreaterThan(0);

        for (const msg of result.messages) {
            expect(msg).toHaveProperty('name');
            expect(msg).toHaveProperty('fields');
            expect(typeof msg.name).toBe('string');
            expect(Array.isArray(msg.fields)).toBe(true);
        }
    });

    it('should parse fields with different modifiers', () => {
        const msg = result.messages.find(m => m.name === 'SearchRequest');
        expect(msg).toBeDefined();

        // Regular field: string query = 1
        const queryField = msg!.fields.find(f => f.name === 'query');
        expect(queryField).toMatchObject({ name: 'query', type: 'string', number: 1 });
        expect(queryField!.modifier).toBeUndefined();

        // Optional field: optional int32 limit = 2
        const limitField = msg!.fields.find(f => f.name === 'limit');
        expect(limitField).toMatchObject({ name: 'limit', type: 'int32', number: 2, modifier: 'optional' });

        // Repeated field: repeated string fields = 5
        const fieldsField = msg!.fields.find(f => f.name === 'fields');
        expect(fieldsField).toMatchObject({ name: 'fields', type: 'string', number: 5, modifier: 'repeated' });

        // Message type field: SearchOptions options = 4
        const optionsField = msg!.fields.find(f => f.name === 'options');
        expect(optionsField).toMatchObject({ name: 'options', type: 'SearchOptions', number: 4 });
    });

    it('should parse map fields', () => {
        const msg = result.messages.find(m => m.name === 'SearchResult');
        expect(msg).toBeDefined();

        // Map field: map<string, string> content = 3
        const mapField = msg!.fields.find(f => f.name === 'content');
        expect(mapField).toMatchObject({ name: 'content', type: 'map<string, string>', number: 3 });
    });

    it('should parse oneofs into ProtoOneof[] with correct values', () => {
        const msg = result.messages.find(m => m.name === 'FilterSettings');
        expect(msg).toBeDefined();
        expect(msg!.oneofs).toHaveLength(1);

        const oneof = msg!.oneofs![0];
        expect(oneof.name).toBe('value');
        expect(oneof.fields.length).toBeGreaterThanOrEqual(4);

        // Check some oneof fields
        expect(oneof.fields.find(f => f.name === 'string_value')).toMatchObject({ type: 'string', number: 2 });
        expect(oneof.fields.find(f => f.name === 'int_value')).toMatchObject({ type: 'int32', number: 3 });
        expect(oneof.fields.find(f => f.name === 'range_value')).toMatchObject({ type: 'RangeFilter', number: 5 });
    });

    it('should parse enums into ProtoEnum[] with correct values', () => {
        const enumDef = result.enums.find(e => e.name === 'SortOrder');
        expect(enumDef).toBeDefined();
        expect(enumDef!.values).toHaveLength(3);

        expect(enumDef!.values[0]).toMatchObject({ name: 'SORT_ORDER_UNSPECIFIED', number: 0 });
        expect(enumDef!.values[1]).toMatchObject({ name: 'SORT_ORDER_ASC', number: 1 });
        expect(enumDef!.values[2]).toMatchObject({ name: 'SORT_ORDER_DESC', number: 2 });
    });

    it('should parse comments', () => {
        // Message comment
        const msg = result.messages.find(m => m.name === 'SearchRequest');
        expect(msg!.comment).toBe('The main search request message');

        // Field comment
        const queryField = msg!.fields.find(f => f.name === 'query');
        expect(queryField!.comment).toBe('Query string to search');

        // Enum comment
        const enumDef = result.enums.find(e => e.name === 'SortOrder');
        expect(enumDef!.comment).toBe('Sort order enumeration');

        // Oneof comment
        const filterMsg = result.messages.find(m => m.name === 'FilterSettings');
        expect(filterMsg!.oneofs![0].comment).toBe('Filter value - can be different types');
    });
});
