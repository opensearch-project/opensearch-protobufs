import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Command, Option } from '@commander-js/extra-typings';
import {
    ProtoMessage,
    ProtoEnum,
    BackwardCompatibilityError
} from './types';
import { parseProtoFile } from './parser';
import { mergeMessage, mergeEnum } from './CompatibilityMerger';
import { generateMessage, generateEnum } from './writer';
import logger from '../utils/logger';

const TEMPLATE_DIR = join(__dirname, '../config/protobuf-schema-template');

// Load fixed header and custom messages from templates
const PROTO_HEADER = readFileSync(join(TEMPLATE_DIR, 'partial_header.mustache'), 'utf-8');
const CUSTOM_MESSAGES = readFileSync(join(TEMPLATE_DIR, 'custom_message.mustache'), 'utf-8');

// ==================== CLI ====================

const command = new Command()
    .description('Merge incoming proto files into existing proto while maintaining backward compatibility.')
    .addOption(new Option('-e, --existing <path>', 'existing proto file (source of truth)').default('protos/schemas/common.proto'))
    .addOption(new Option('-i, --incoming <paths>', 'incoming proto files (comma-separated)')
        .argParser((val: string) => val.split(',').map(s => s.trim()))
        .default(['protos/generated/models/aggregated_models.proto', 'protos/generated/services/default_service.proto']))
    .addOption(new Option('-o, --output <path>', 'output proto file').default('protos/schemas/common.proto'))
    .allowExcessArguments(false)
    .parse();

type BackwardCompatOpts = {
    existing: string;
    incoming: string[];
    output: string;
};

const opts = command.opts() as BackwardCompatOpts;

// Messages defined in custom_message.mustache - skip and use template instead
const CUSTOM_MESSAGE_NAMES = new Set(['ObjectMap', 'GeneralNumber']);
const CUSTOM_ENUM_NAMES = new Set(['NullValue']);

export class BackwardCompatibleWriter {
    private existingMessages: ProtoMessage[];
    private existingEnums: ProtoEnum[];
    private incomingMessageMap: Map<string, ProtoMessage> = new Map();
    private incomingEnumMap: Map<string, ProtoEnum> = new Map();
    private errors: string[] = [];
    private outputPath: string;

    constructor(existingPath: string, incomingPaths: string[], outputPath: string) {
        this.outputPath = outputPath;

        for (const incomingPath of incomingPaths) {
            if (existsSync(incomingPath)) {
                const parsed = parseProtoFile(incomingPath);
                this.buildIncomingMaps(parsed.messages, parsed.enums);
            }
        }

        const existingParsed = parseProtoFile(existingPath);
        this.existingMessages = existingParsed.messages;
        this.existingEnums = existingParsed.enums;
    }

    private buildIncomingMaps(messages: ProtoMessage[], enums: ProtoEnum[]): void {
        for (const msg of messages) {
            if (!this.incomingMessageMap.has(msg.name)) {
                this.incomingMessageMap.set(msg.name, msg);
            }
        }
        for (const e of enums) {
            if (!this.incomingEnumMap.has(e.name)) {
                this.incomingEnumMap.set(e.name, e);
            }
        }
    }

    process(): void {
        const outputParts: string[] = [];

        // Use fixed header from template
        outputParts.push(PROTO_HEADER.trim());

        // Process messages
        for (const existingMsg of this.existingMessages) {
            if (CUSTOM_MESSAGE_NAMES.has(existingMsg.name)) {
                this.incomingMessageMap.delete(existingMsg.name);
                continue;
            }

            const incomingMsg = this.incomingMessageMap.get(existingMsg.name);

            if (incomingMsg) {
                const mergedMsg = mergeMessage(existingMsg, incomingMsg, this.errors);
                outputParts.push(generateMessage(mergedMsg));
                this.incomingMessageMap.delete(existingMsg.name);
            } else {
                outputParts.push(generateMessage(existingMsg));
            }
        }

        // Process enums
        for (const existingEnum of this.existingEnums) {
            if (CUSTOM_ENUM_NAMES.has(existingEnum.name)) {
                this.incomingEnumMap.delete(existingEnum.name);
                continue;
            }

            const incomingEnum = this.incomingEnumMap.get(existingEnum.name);

            if (incomingEnum) {
                const mergedEnum = mergeEnum(existingEnum, incomingEnum);
                outputParts.push(generateEnum(mergedEnum));
                this.incomingEnumMap.delete(existingEnum.name);
            } else {
                outputParts.push(generateEnum(existingEnum));
            }
        }

        // Append new messages from incoming proto files
        for (const [, msg] of this.incomingMessageMap) {
            outputParts.push('');
            outputParts.push(generateMessage(msg));
        }

        // Append new enums from incoming proto files
        for (const [, protoEnum] of this.incomingEnumMap) {
            outputParts.push('');
            outputParts.push(generateEnum(protoEnum));
        }

        // Append custom messages from template (ObjectMap, GeneralNumber, NullValue)
        outputParts.push('');
        outputParts.push(CUSTOM_MESSAGES.trim());

        // Check for errors before writing
        if (this.errors.length > 0) {
            logger.error('Backward compatibility errors:');
            for (const error of this.errors) {
                logger.error(`  ${error}`);
            }
            throw new BackwardCompatibilityError(
                `Found ${this.errors.length} backward compatibility violation(s).`
            );
        }

        writeFileSync(this.outputPath, outputParts.join('\n'));
        logger.info(`Updated: ${this.outputPath}`);
    }
}

// ==================== RUN ====================

if (!existsSync(opts.existing)) {
    logger.error(`Existing file not found: ${opts.existing}`);
    process.exit(1);
}

const existingIncoming = opts.incoming.filter(p => existsSync(p));
if (existingIncoming.length === 0) {
    logger.error(`No incoming proto files found.`);
    process.exit(1);
}

try {
    const writer = new BackwardCompatibleWriter(
        opts.existing,
        opts.incoming,
        opts.output
    );
    writer.process();
} catch (error) {
    if (error instanceof BackwardCompatibilityError) {
        process.exit(1);
    }
    throw error;
}

export { BackwardCompatibilityError };
