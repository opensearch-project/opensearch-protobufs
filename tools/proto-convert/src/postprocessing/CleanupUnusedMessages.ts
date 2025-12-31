/**
 *
 * Given root protobuf messages, removes all messages NOT referenced
 * (directly or indirectly) by any root message.
 */

import { existsSync } from 'fs';
import { Command, Option } from '@commander-js/extra-typings';
import { parseProtoFile } from './parser';
import { writeProtoFile, CUSTOM_MESSAGE_NAMES, CUSTOM_ENUM_NAMES } from './writer';
import { ProtoMessage, ProtoEnum } from './types';
import logger from '../utils/logger';

export function isBuiltInType(type: string): boolean {
    const builtIns = new Set([
        'double', 'float', 'int32', 'int64', 'uint32', 'uint64',
        'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64',
        'bool', 'string', 'bytes'
    ]);
    return builtIns.has(type);
}

/**
 * Collect all type references from a message (fields + oneofs).
 */
function getMessageReferences(msg: ProtoMessage): Set<string> {
    const refs = new Set<string>();

    for (const field of msg.fields) {
        if (!isBuiltInType(field.type)) {
            refs.add(field.type);
        }
    }

    for (const oneof of msg.oneofs || []) {
        for (const field of oneof.fields) {
            if (!isBuiltInType(field.type)) {
                refs.add(field.type);
            }
        }
    }

    return refs;
}

/**
 * Find all types reachable from root messages.
 */
export function findReachableTypes(
    rootMessages: string[],
    messages: ProtoMessage[]
): Set<string> {
    const messageMap = new Map(messages.map(m => [m.name, m]));
    const reachable = new Set<string>();
    const queue = [...rootMessages];

    while (queue.length > 0) {
        const current = queue.shift()!;

        if (reachable.has(current)) continue;
        reachable.add(current);

        const msg = messageMap.get(current);
        if (msg) {
            for (const ref of getMessageReferences(msg)) {
                // Handle map types
                const mapMatch = ref.match(/^map<(.+),\s*(.+)>$/);
                if (mapMatch) {
                    const [, keyType, valueType] = mapMatch;
                    if (!isBuiltInType(keyType) && !reachable.has(keyType)) queue.push(keyType);
                    if (!isBuiltInType(valueType) && !reachable.has(valueType)) queue.push(valueType);
                } else if (!reachable.has(ref)) {
                    queue.push(ref);
                }
            }
        }
    }

    return reachable;
}

/**
 * Filter messages to only include reachable ones.
 */
export function filterMessages(
    messages: ProtoMessage[],
    reachable: Set<string>
): ProtoMessage[] {
    return messages.filter(m =>
        reachable.has(m.name) || CUSTOM_MESSAGE_NAMES.has(m.name)
    );
}

/**
 * Filter enums to only include referenced ones.
 */
export function filterEnums(
    enums: ProtoEnum[],
    reachable: Set<string>
): ProtoEnum[] {
    return enums.filter(e =>
        reachable.has(e.name) || CUSTOM_ENUM_NAMES.has(e.name)
    );
}

/**
 * Extract root message names from service definitions (all request/response types).
 */
export function extractRootsFromServices(servicePath: string): string[] {
    const parsed = parseProtoFile(servicePath);
    const roots = new Set<string>();

    for (const service of parsed.services) {
        for (const rpc of service.rpcs) {
            roots.add(rpc.requestType);
            roots.add(rpc.responseType);
        }
    }

    return Array.from(roots);
}

export type CleanupOptions = {
    input: string;
    output?: string;
    service?: string;
    roots?: string[];
};

/**
 * Clean up unused messages and enums from a proto file.
 * Returns the number of removed messages and enums.
 */
export function cleanupUnusedMessages(opts: CleanupOptions): { removedMessages: number; removedEnums: number } {
    if (!existsSync(opts.input)) {
        throw new Error(`Input file not found: ${opts.input}`);
    }

    // Get roots
    let roots: string[];
    if (opts.roots && opts.roots.length > 0) {
        roots = opts.roots;
    } else if (opts.service && existsSync(opts.service)) {
        roots = extractRootsFromServices(opts.service);
    } else {
        throw new Error(`Service file not found: ${opts.service}. Specify roots manually.`);
    }

    const parsed = parseProtoFile(opts.input);

    // Verify root messages exist
    const messageNames = new Set(parsed.messages.map(m => m.name));
    for (const rootMsg of roots) {
        if (!messageNames.has(rootMsg)) {
            throw new Error(`Root message not found: ${rootMsg}`);
        }
    }

    // Find reachable types
    const reachable = findReachableTypes(roots, parsed.messages);

    // Filter to keep only reachable messages and enums
    const keptMessages = filterMessages(parsed.messages, reachable);
    const keptEnums = filterEnums(parsed.enums, reachable);

    const removedMessages = parsed.messages.length - keptMessages.length;
    const removedEnums = parsed.enums.length - keptEnums.length;

    // Write output
    const outputPath = opts.output || opts.input;
    writeProtoFile(keptMessages, keptEnums, outputPath);

    return { removedMessages, removedEnums };
}

// ==================== CLI ====================
/* istanbul ignore next -- CLI entry point */

if (require.main === module) {
    const command = new Command()
        .description('Remove unused messages and enums from a proto file.')
        .addOption(new Option('-i, --input <path>', 'input proto file').default('protos/generated/models/aggregated_models.proto'))
        .addOption(new Option('-o, --output <path>', 'output proto file (defaults to input)'))
        .addOption(new Option('-s, --service <path>', 'service proto file to auto-detect roots')
            .default('protos/generated/services/default_service.proto'))
        .addOption(new Option('-r, --roots <names>', 'root message names (comma-separated, overrides --service)')
            .argParser((val: string) => val.split(',').map(s => s.trim())))
        .allowExcessArguments(false)
        .parse();

    const opts = command.opts() as CleanupOptions;

    try {
        const { removedMessages, removedEnums } = cleanupUnusedMessages(opts);
        logger.info(`Removed ${removedMessages} messages, ${removedEnums} enums. Updated: ${opts.output || opts.input}`);
    } catch (error) {
        logger.error((error as Error).message);
        process.exit(1);
    }
}
