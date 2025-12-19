/**
 * Tests for CleanupUnusedMessages module.
 */

import * as path from 'path';
import { parseProtoFile } from '../../src/postprocessing/parser';
import {
    isBuiltInType,
    findReachableTypes,
    filterMessages,
    filterEnums,
    extractRootsFromServices
} from '../../src/postprocessing/CleanupUnusedMessages';
import { ProtoMessage, ProtoEnum } from '../../src/postprocessing/types';

const TEST_PROTO = path.join(__dirname, '../fixtures/proto/test.proto');
const TEST_SERVICE_PROTO = path.join(__dirname, '../fixtures/proto/test_service.proto');

describe('CleanupUnusedMessages', () => {
    const parsed = parseProtoFile(TEST_PROTO);

    describe('findReachableTypes', () => {
        it('should identify reachable messages from roots', () => {
            const reachable = findReachableTypes(['SearchRequest', 'SearchResponse'], parsed.messages);

            // Root messages are reachable
            expect(reachable.has('SearchRequest')).toBe(true);
            expect(reachable.has('SearchResponse')).toBe(true);

            // Direct references are reachable
            expect(reachable.has('SearchOptions')).toBe(true);
            expect(reachable.has('SearchResult')).toBe(true);
        });

        it('should follow transitive references', () => {
            const reachable = findReachableTypes(['SearchRequest'], parsed.messages);

            // SearchRequest -> SearchOptions -> FilterSettings -> RangeFilter
            expect(reachable.has('SearchOptions')).toBe(true);
            expect(reachable.has('FilterSettings')).toBe(true);
            expect(reachable.has('RangeFilter')).toBe(true);
        });

        it('should follow oneof field references', () => {
            const reachable = findReachableTypes(['SearchRequest'], parsed.messages);

            // FilterSettings has oneof with RangeFilter
            expect(reachable.has('RangeFilter')).toBe(true);
        });

        it('should handle map types with custom value types', () => {
            // Create test messages with map type
            const messages: ProtoMessage[] = [
                {
                    name: 'RootMessage',
                    fields: [{ name: 'data', type: 'map<string, CustomValue>', number: 1 }]
                },
                {
                    name: 'CustomValue',
                    fields: [{ name: 'value', type: 'string', number: 1 }]
                },
                {
                    name: 'Unreachable',
                    fields: [{ name: 'x', type: 'int32', number: 1 }]
                }
            ];

            const reachable = findReachableTypes(['RootMessage'], messages);

            expect(reachable.has('RootMessage')).toBe(true);
            expect(reachable.has('CustomValue')).toBe(true);
            expect(reachable.has('Unreachable')).toBe(false);
        });

        it('should handle map types with custom key types', () => {
            const messages: ProtoMessage[] = [
                {
                    name: 'RootMessage',
                    fields: [{ name: 'data', type: 'map<CustomKey, string>', number: 1 }]
                },
                {
                    name: 'CustomKey',
                    fields: [{ name: 'id', type: 'string', number: 1 }]
                }
            ];

            const reachable = findReachableTypes(['RootMessage'], messages);

            expect(reachable.has('CustomKey')).toBe(true);
        });

        it('should handle circular references without infinite loop', () => {
            const messages: ProtoMessage[] = [
                {
                    name: 'NodeA',
                    fields: [{ name: 'next', type: 'NodeB', number: 1 }]
                },
                {
                    name: 'NodeB',
                    fields: [{ name: 'back', type: 'NodeA', number: 1 }]
                }
            ];

            const reachable = findReachableTypes(['NodeA'], messages);

            expect(reachable.has('NodeA')).toBe(true);
            expect(reachable.has('NodeB')).toBe(true);
        });

        it('should handle self-referencing messages', () => {
            const messages: ProtoMessage[] = [
                {
                    name: 'TreeNode',
                    fields: [
                        { name: 'value', type: 'string', number: 1 },
                        { name: 'children', type: 'TreeNode', number: 2, modifier: 'repeated' }
                    ]
                }
            ];

            const reachable = findReachableTypes(['TreeNode'], messages);

            expect(reachable.has('TreeNode')).toBe(true);
        });

        it('should handle empty root list', () => {
            const reachable = findReachableTypes([], parsed.messages);

            expect(reachable.size).toBe(0);
        });

        it('should handle non-existent root message', () => {
            const reachable = findReachableTypes(['NonExistentMessage'], parsed.messages);

            // Should still add it to reachable (just won't traverse further)
            expect(reachable.has('NonExistentMessage')).toBe(true);
            expect(reachable.size).toBe(1);
        });

        it('should not include unreachable messages', () => {
            const reachable = findReachableTypes(['SearchRequest', 'SearchResponse'], parsed.messages);

            expect(reachable.has('UnusedMessage')).toBe(false);
            expect(reachable.has('UnusedChild')).toBe(false);
            expect(reachable.has('AnotherUnused')).toBe(false);
        });
    });

    describe('filterMessages', () => {
        it('should filter messages to keep only reachable ones', () => {
            const reachable = findReachableTypes(['SearchRequest', 'SearchResponse'], parsed.messages);
            const kept = filterMessages(parsed.messages, reachable);

            const keptNames = kept.map(m => m.name);
            expect(keptNames).toContain('SearchRequest');
            expect(keptNames).toContain('SearchResponse');
            expect(keptNames).not.toContain('UnusedMessage');
            expect(keptNames).not.toContain('AnotherUnused');
        });

        it('should always keep custom message names (ObjectMap, GeneralNumber)', () => {
            const messages: ProtoMessage[] = [
                { name: 'ObjectMap', fields: [] },
                { name: 'GeneralNumber', fields: [] },
                { name: 'RegularMessage', fields: [] }
            ];

            // Empty reachable set
            const kept = filterMessages(messages, new Set());

            const keptNames = kept.map(m => m.name);
            expect(keptNames).toContain('ObjectMap');
            expect(keptNames).toContain('GeneralNumber');
            expect(keptNames).not.toContain('RegularMessage');
        });
    });

    describe('filterEnums', () => {
        it('should filter enums to keep only referenced ones', () => {
            const reachable = findReachableTypes(['SearchRequest', 'SearchResponse'], parsed.messages);
            const kept = filterEnums(parsed.enums, reachable);

            const keptNames = kept.map(e => e.name);
            // SortOrder is referenced by SearchOptions
            expect(keptNames).toContain('SortOrder');
            expect(keptNames).not.toContain('UnusedEnum');
        });

        it('should always keep custom enum names (NullValue)', () => {
            const enums: ProtoEnum[] = [
                { name: 'NullValue', values: [{ name: 'NULL_VALUE', number: 0 }] },
                { name: 'RegularEnum', values: [{ name: 'VALUE', number: 0 }] }
            ];

            // Empty reachable set
            const kept = filterEnums(enums, new Set());

            const keptNames = kept.map(e => e.name);
            expect(keptNames).toContain('NullValue');
            expect(keptNames).not.toContain('RegularEnum');
        });

        it('should handle enum referenced in reachable set', () => {
            const enums: ProtoEnum[] = [
                { name: 'MyEnum', values: [{ name: 'VALUE', number: 0 }] }
            ];

            const reachable = new Set(['MyEnum']);
            const kept = filterEnums(enums, reachable);

            expect(kept.length).toBe(1);
            expect(kept[0].name).toBe('MyEnum');
        });
    });
});

describe('extractRootsFromServices', () => {
    it('should extract request and response types from service definitions', () => {
        const roots = extractRootsFromServices(TEST_SERVICE_PROTO);

        expect(roots).toContain('SearchRequest');
        expect(roots).toContain('SearchResponse');
        expect(roots).toContain('GetDocumentRequest');
        expect(roots).toContain('GetDocumentResponse');
    });

    it('should return unique root names', () => {
        const roots = extractRootsFromServices(TEST_SERVICE_PROTO);

        // Should have exactly 4 unique roots
        expect(roots.length).toBe(4);
        expect(new Set(roots).size).toBe(roots.length);
    });
});

describe('isBuiltInType', () => {
    it('should return true for all built-in numeric types', () => {
        expect(isBuiltInType('int32')).toBe(true);
        expect(isBuiltInType('int64')).toBe(true);
        expect(isBuiltInType('uint32')).toBe(true);
        expect(isBuiltInType('uint64')).toBe(true);
        expect(isBuiltInType('sint32')).toBe(true);
        expect(isBuiltInType('sint64')).toBe(true);
        expect(isBuiltInType('fixed32')).toBe(true);
        expect(isBuiltInType('fixed64')).toBe(true);
        expect(isBuiltInType('sfixed32')).toBe(true);
        expect(isBuiltInType('sfixed64')).toBe(true);
        expect(isBuiltInType('float')).toBe(true);
        expect(isBuiltInType('double')).toBe(true);
    });

    it('should return true for other built-in types', () => {
        expect(isBuiltInType('string')).toBe(true);
        expect(isBuiltInType('bool')).toBe(true);
        expect(isBuiltInType('bytes')).toBe(true);
    });

    it('should return false for custom types', () => {
        expect(isBuiltInType('SearchRequest')).toBe(false);
        expect(isBuiltInType('SearchOptions')).toBe(false);
        expect(isBuiltInType('SortOrder')).toBe(false);
        expect(isBuiltInType('MyCustomMessage')).toBe(false);
    });

    it('should return false for map types', () => {
        expect(isBuiltInType('map<string, string>')).toBe(false);
        expect(isBuiltInType('map<int32, CustomType>')).toBe(false);
    });
});
