import { existsSync } from 'fs';
import { Command, Option } from '@commander-js/extra-typings';
import { ProtoMessage, ProtoEnum } from './types';
import { parseProtoFile } from './parser';
import { mergeMessage, mergeEnum } from './CompatibilityMerger';
import { writeProtoFile, CUSTOM_MESSAGE_NAMES, CUSTOM_ENUM_NAMES } from './writer';
import { CompatibilityReporter } from './CompatibilityReporter';
import logger from '../utils/logger';

export class BackwardCompatibleWriter {
    private existingMessages: ProtoMessage[];
    private existingEnums: ProtoEnum[];
    private incomingMessageMap: Map<string, ProtoMessage> = new Map();
    private incomingEnumMap: Map<string, ProtoEnum> = new Map();
    private outputPath: string;
    private reporter: CompatibilityReporter = new CompatibilityReporter();

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

    process(dryRun: boolean = false): void {
        const finalMessages: ProtoMessage[] = [];
        const finalEnums: ProtoEnum[] = [];

        // Process existing messages (merge with incoming if present)
        for (const existingMsg of this.existingMessages) {
            if (CUSTOM_MESSAGE_NAMES.has(existingMsg.name)) {
                this.incomingMessageMap.delete(existingMsg.name);
                continue;
            }

            const incomingMsg = this.incomingMessageMap.get(existingMsg.name);
            if (incomingMsg) {
                finalMessages.push(mergeMessage(existingMsg, incomingMsg, this.reporter));
                this.incomingMessageMap.delete(existingMsg.name);
            } else {
                finalMessages.push(existingMsg);
            }
        }

        // Process existing enums (merge with incoming if present)
        for (const existingEnum of this.existingEnums) {
            if (CUSTOM_ENUM_NAMES.has(existingEnum.name)) {
                this.incomingEnumMap.delete(existingEnum.name);
                continue;
            }

            const incomingEnum = this.incomingEnumMap.get(existingEnum.name);
            if (incomingEnum) {
                finalEnums.push(mergeEnum(existingEnum, incomingEnum, this.reporter));
                this.incomingEnumMap.delete(existingEnum.name);
            } else {
                finalEnums.push(existingEnum);
            }
        }

        // Add new messages from incoming (not in existing)
        for (const [, msg] of this.incomingMessageMap) {
            if (!CUSTOM_MESSAGE_NAMES.has(msg.name)) {
                finalMessages.push(msg);
            }
        }

        // Add new enums from incoming (not in existing)
        for (const [, protoEnum] of this.incomingEnumMap) {
            if (!CUSTOM_ENUM_NAMES.has(protoEnum.name)) {
                finalEnums.push(protoEnum);
            }
        }

        // Write output
        if (dryRun) {
            logger.info(`Dry run: would update ${this.outputPath}`);
        } else {
            writeProtoFile(finalMessages, finalEnums, this.outputPath);
            logger.info(`Updated: ${this.outputPath}`);
        }
    }

    /**
     * Get the merge reporter for accessing change reports.
     */
    getReporter(): CompatibilityReporter {
        return this.reporter;
    }
}

// ==================== CLI ====================

/* istanbul ignore next -- CLI entry point */
if (require.main === module) {
    const command = new Command()
        .description('Merge incoming proto files into existing proto while maintaining backward compatibility.')
        .addOption(new Option('-e, --existing <path>', 'existing proto file (source of truth)').default('protos/schemas/common.proto'))
        .addOption(new Option('-i, --incoming <paths>', 'incoming proto files (comma-separated)')
            .argParser((val: string) => val.split(',').map(s => s.trim()))
            .default(['protos/generated/models/aggregated_models.proto', 'protos/generated/services/default_service.proto']))
        .addOption(new Option('-o, --output <path>', 'output proto file').default('protos/schemas/common.proto'))
        .addOption(new Option('-d, --dry-run', 'preview changes without writing output file').default(false))
        .allowExcessArguments(false)
        .parse();

    type BackwardCompatOpts = {
        existing: string;
        incoming: string[];
        output: string;
        dryRun: boolean;
    };

    const opts = command.opts() as BackwardCompatOpts;

    if (!existsSync(opts.existing)) {
        logger.error(`Existing file not found: ${opts.existing}`);
        process.exit(1);
    }

    const existingIncoming = opts.incoming.filter(p => existsSync(p));
    if (existingIncoming.length === 0) {
        logger.error(`No incoming proto files found.`);
        process.exit(1);
    }

    const writer = new BackwardCompatibleWriter(
        opts.existing,
        opts.incoming,
        opts.output
    );

    // Process and merge
    writer.process(opts.dryRun);

    // Write report to temp directory
    const reportPath = writer.getReporter().writeToFile();
    logger.info(`Report written: ${reportPath}`);
}
