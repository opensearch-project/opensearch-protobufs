import { format } from "util";
import * as protobuf from "protobufjs";
import * as fs from "fs"
import Logger from './utils/logger';
import {write_text} from "./utils/helper";

const MESSAGE_FIELD_TEMPLATE = "%s_%s";
const field_number_map = new Map<string, number>();

export class ProtoFieldNumberMatcher {
    logger: Logger
    constructor(logger: Logger = new Logger()) {
        this.logger = logger
    }

    public match_proto(proto_source: string, proto_target: string, write_path: string): void {
        // Parse the source .proto file and save to map.
        const source_file = fs.readFileSync(proto_source, "utf-8");
        if (!source_file) {
            this.logger.error(`Source proto file not found: ${proto_source}`);
            return;
        }
        const source_proto = protobuf.parse(source_file, { keepCase: true }).root;
        this.collect_proto_ids(source_proto)

        // Parse the target .proto file and replace the field numbers.
        const target_file = fs.readFileSync(proto_target, "utf-8");
        if (!target_file) {
            this.logger.error(`Target proto file not found: ${proto_target}`);
            return;
        }
        const target_proto = protobuf.parse(target_file, { keepCase: true }).root;
        this.map_proto_ids(target_proto)

        this.write_replace_file(proto_target, write_path)
    }

    get_max_message_id(type: protobuf.Type, messageName: string): number {
        return Math.max(
            0,
            ...Object.keys(type.fields).map(fieldName =>
                field_number_map.get(format(MESSAGE_FIELD_TEMPLATE, messageName, fieldName)) || 0
            )
        );
    }

    get_max_enum_id(type: protobuf.Enum, message_name: string): number {
        return Math.max(
            0,
            ...Object.entries(type.values)
                .map(([fieldName]) => field_number_map.get(format(MESSAGE_FIELD_TEMPLATE, message_name, fieldName)) || 0)
        );
    }

    map_proto_ids(namespace: protobuf.NamespaceBase) {
        if (!namespace.nested) return;

        for (const [name, definition] of Object.entries(namespace.nested)) {
            if (name.startsWith("google")) continue;

            if (definition instanceof protobuf.Type) {
                let max = this.get_max_message_id(definition, name);
                for (const [fieldName] of Object.entries(definition.fields)) {
                    const messageFieldName = format(MESSAGE_FIELD_TEMPLATE, name, fieldName);
                    if (!field_number_map.has(messageFieldName)) {
                        field_number_map.set(messageFieldName, ++max);
                    }
                }
            } else if (definition instanceof protobuf.Enum) {
                let max = this.get_max_enum_id(definition, name);
                console.log("max", max)
                for (const [fieldName] of Object.entries(definition.values)) {
                    const messageFieldName = format(MESSAGE_FIELD_TEMPLATE, name, fieldName);
                    if (!field_number_map.has(messageFieldName)) {
                        field_number_map.set(messageFieldName, ++max);
                    }
                }
            } else if (definition instanceof protobuf.Namespace) {
                this.map_proto_ids(definition);
            } else {
                this.logger.warn(`Unknown Definition: ${name}`);
            }
        }
    }

    collect_proto_ids(namespace: protobuf.NamespaceBase) {
        if (!namespace.nested) return;

        for (const [name, definition] of Object.entries(namespace.nested)) {
            if (name.startsWith("google")) continue;

            if (definition instanceof protobuf.Type) {
                for (const [fieldName, field] of Object.entries(definition.fields)) {
                    field_number_map.set(format(MESSAGE_FIELD_TEMPLATE, name, fieldName), field.id);
                }
            } else if (definition instanceof protobuf.Enum) {
                for (const [fieldName, field] of Object.entries(definition.values)) {
                    field_number_map.set(format(MESSAGE_FIELD_TEMPLATE, name, fieldName), field);
                }
            } else if (definition instanceof protobuf.Namespace) {
                this.collect_proto_ids(definition);
            } else {
                this.logger.info(`Unknown Definition: ${name}`);
            }
        }
    }

    write_replace_file(source_path: string, writePath: string): void {
        const protoContent = fs.readFileSync(source_path, 'utf-8');
        let modifiedContent = this.reconstruct_message(protoContent);
        modifiedContent = this.reconstruct_enum(modifiedContent)
        write_text(writePath, modifiedContent);
        this.logger.info(`Modified proto file saved as ${writePath}`);
    }

    reconstruct_enum(protoContent: string): string{
        const enumRegex = /enum\s+(\w+)\s*{([^}]*)}/g;
        let match;
        let modifiedContent = protoContent;
        while ((match = enumRegex.exec(protoContent)) !== null) {
            const enumName = match[1];
            const enumBody = match[2];
            let lines = enumBody.split("\n");

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let trimmedLine = line.trim();

                if (!trimmedLine.includes("=") || !trimmedLine.endsWith(";")) {
                    continue;
                }

                const leadingSpaces = line.match(/^\s*/)?.[0] || "";
                let [enum_field_name, enum_field_number] = trimmedLine.split(" = ").map(part => part.trim());

                const messageFieldName = format(MESSAGE_FIELD_TEMPLATE, enumName, enum_field_name);
                let newFieldNumber = field_number_map.get(messageFieldName) ?? 10000;

                // Reconstruct the field with new field number
                let updatedField = `${leadingSpaces}${enum_field_name} = ${newFieldNumber};`;

                lines[i] = updatedField;
            }
            let modifiedEnumBody = lines.join("\n");
            modifiedContent = modifiedContent.replace(match[0], `enum ${enumName} {${modifiedEnumBody}}`);
        }

        return modifiedContent
    }

    reconstruct_message(protoContent: string): string{

        const messageRegex = /message\s+(\w+)\s*{([^}]*)}/g;
        let match;
        let modifiedContent = protoContent;

        while ((match = messageRegex.exec(protoContent)) !== null) {
            const messageName = match[1];
            const messageBody = match[2];

            let lines = messageBody.split("\n");

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let trimmedLine = line.trim();

                if (!trimmedLine.includes("=") || !trimmedLine.endsWith(";")) {
                    continue;
                }

                const leadingSpaces = line.match(/^\s*/)?.[0] || "";

                let [preField, postField] = trimmedLine.split(" = ").map(part => part.trim());
                let preFieldParts = preField.split(/\s+/);
                let fieldType = "";
                let fieldName = "";

                if (preFieldParts.length === 2) {
                    [fieldType, fieldName] = preFieldParts;
                } else if (preFieldParts.length === 3) {
                    [, fieldType, fieldName] = preFieldParts;
                } else {
                    this.logger.warn("invalid format")
                }

                let postFieldParts = postField.split(/\s+/);
                let extensions = "";
                if(postFieldParts.length > 1){
                    extensions = postFieldParts[1]
                }

                const messageFieldName = format(MESSAGE_FIELD_TEMPLATE, messageName, fieldName);
                let newFieldNumber = field_number_map.get(messageFieldName) ?? 10000;

                // Reconstruct the field with new field number
                let updatedField = `${leadingSpaces}${preField} = ${newFieldNumber}${extensions ? ` ${extensions}` : ";"}`;

                lines[i] = updatedField;
            }

            let modifiedMessageBody = lines.join("\n");
            modifiedContent = modifiedContent.replace(match[0], `message ${messageName} {${modifiedMessageBody}}`);

        }
        return modifiedContent
    }
}

