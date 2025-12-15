/**
 *
 * Given root protobuf messages, removes all messages NOT referenced
 * (directly or indirectly) by any root message.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Command, Option } from '@commander-js/extra-typings';
import { parseProtoFile } from './parser';
import { generateMessage, generateEnum } from './writer';
import { ProtoMessage, ProtoEnum } from './types';
import logger from '../utils/logger';

const TEMPLATE_DIR = join(__dirname, '../config/protobuf-schema-template');

// Load fixed header and custom messages from templates
const PROTO_HEADER = readFileSync(join(TEMPLATE_DIR, 'partial_header.mustache'), 'utf-8');
const CUSTOM_MESSAGES = readFileSync(join(TEMPLATE_DIR, 'custom_message.mustache'), 'utf-8');

// Custom messages/enums defined in template - always included at end
const CUSTOM_MESSAGE_NAMES = new Set(['ObjectMap', 'GeneralNumber']);
const CUSTOM_ENUM_NAMES = new Set(['NullValue']);

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

// ==================== CLI ====================

if (require.main === module) {
    const command = new Command()
        .description('Remove unused messages and enums from a proto file.')
        .addOption(new Option('-i, --input <path>', 'input proto file').default('protos/schemas/common.proto'))
        .addOption(new Option('-o, --output <path>', 'output proto file (defaults to input)'))
        .addOption(new Option('-r, --roots <names>', 'root message names (comma-separated)')
            .argParser((val: string) => val.split(',').map(s => s.trim()))
            .default(['SearchRequest', 'SearchResponse', 'BulkRequest', 'BulkResponse']))
        .allowExcessArguments(false)
        .parse();

    type CleanupOpts = {
        input: string;
        output?: string;
        roots: string[];
    };

    const opts = command.opts() as CleanupOpts;

    if (!existsSync(opts.input)) {
        logger.error(`Input file not found: ${opts.input}`);
        process.exit(1);
    }

    const parsed = parseProtoFile(opts.input);

    // Verify root messages exist
    const messageNames = new Set(parsed.messages.map(m => m.name));
    for (const rootMsg of opts.roots) {
        if (!messageNames.has(rootMsg)) {
            logger.error(`Root message not found: ${rootMsg}`);
            process.exit(1);
        }
    }

    // Find reachable types
    const reachable = findReachableTypes(opts.roots, parsed.messages);

    // Filter to keep only reachable
    const keptMessages = filterMessages(parsed.messages, reachable);
    const keptEnums = filterEnums(parsed.enums, reachable);

    const removedMessages = parsed.messages.length - keptMessages.length;
    const removedEnums = parsed.enums.length - keptEnums.length;

    if (removedMessages === 0 && removedEnums === 0) {
        logger.info('No unused messages or enums found.');
        process.exit(0);
    }

    logger.info(`Removing ${removedMessages} unused messages, ${removedEnums} unused enums.`);

    // Generate output
    const outputParts: string[] = [];

    // Use fixed header from template
    outputParts.push(PROTO_HEADER.trim());

    // Generate messages (excluding custom ones - they're added from template)
    for (const msg of keptMessages) {
        if (!CUSTOM_MESSAGE_NAMES.has(msg.name)) {
            outputParts.push(generateMessage(msg));
        }
    }

    // Generate enums (excluding custom ones)
    for (const e of keptEnums) {
        if (!CUSTOM_ENUM_NAMES.has(e.name)) {
            outputParts.push(generateEnum(e));
        }
    }

    // Append custom messages from template
    outputParts.push('');
    outputParts.push(CUSTOM_MESSAGES.trim());

    const outputPath = opts.output || opts.input;
    writeFileSync(outputPath, outputParts.join('\n'));

    logger.info(`Updated: ${outputPath}`);
}
