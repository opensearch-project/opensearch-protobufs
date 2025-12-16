/**
 * Tests for CleanupUnusedMessages module.
 */

import * as path from 'path';
import { parseProtoFile } from '../../src/postprocessing/parser';
import {
    isBuiltInType,
    findReachableTypes,
    filterMessages,
    filterEnums
} from '../../src/postprocessing/CleanupUnusedMessages';

const TEST_PROTO = path.join(__dirname, '../fixtures/proto/test.proto');

describe('CleanupUnusedMessages', () => {
    const parsed = parseProtoFile(TEST_PROTO);

    it('should identify reachable messages from roots', () => {
        const reachable = findReachableTypes(['SearchRequest', 'SearchResponse'], parsed.messages);

        // Root messages are reachable
        expect(reachable.has('SearchRequest')).toBe(true);
        expect(reachable.has('SearchResponse')).toBe(true);

        // Direct references are reachable
        expect(reachable.has('SearchOptions')).toBe(true);
        expect(reachable.has('SearchResult')).toBe(true);
    });

    it('should filter messages to keep only reachable ones', () => {
        const reachable = findReachableTypes(['SearchRequest', 'SearchResponse'], parsed.messages);
        const kept = filterMessages(parsed.messages, reachable);

        const keptNames = kept.map(m => m.name);
        expect(keptNames).toContain('SearchRequest');
        expect(keptNames).toContain('SearchResponse');
        expect(keptNames).not.toContain('UnusedMessage');
        expect(keptNames).not.toContain('AnotherUnused');
    });

    it('should filter enums to keep only referenced ones', () => {
        const reachable = findReachableTypes(['SearchRequest', 'SearchResponse'], parsed.messages);
        const kept = filterEnums(parsed.enums, reachable);

        const keptNames = kept.map(e => e.name);
        // SortOrder is referenced by SearchOptions
        expect(keptNames).toContain('SortOrder');
        expect(keptNames).not.toContain('UnusedEnum');
    });
});

describe('isBuiltInType', () => {
    it('should return true for built-in types', () => {
        expect(isBuiltInType('int32')).toBe(true);
        expect(isBuiltInType('int64')).toBe(true);
        expect(isBuiltInType('string')).toBe(true);
        expect(isBuiltInType('bool')).toBe(true);
        expect(isBuiltInType('float')).toBe(true);
        expect(isBuiltInType('double')).toBe(true);
        expect(isBuiltInType('bytes')).toBe(true);
    });

    it('should return false for custom types', () => {
        expect(isBuiltInType('SearchRequest')).toBe(false);
        expect(isBuiltInType('SearchOptions')).toBe(false);
        expect(isBuiltInType('SortOrder')).toBe(false);
    });
});
