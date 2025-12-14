/**
 * Internal types for proto processing.
 * These types provide a simplified, template-ready representation
 * of protobuf messages and enums.
 */

export interface FieldOption {
    name: string;
    value: string;
}

export interface ProtoField {
    name: string;
    type: string;
    number: number;
    modifier?: string;  // 'optional' | 'repeated'
    comment?: string;
    options?: FieldOption[];
}

export interface ProtoOneof {
    name: string;
    comment?: string;
    fields: ProtoField[];
}

export interface ProtoEnumValue {
    name: string;
    number: number;
    comment?: string;
    options?: FieldOption[];
}

export interface ProtoEnum {
    name: string;
    comment?: string;
    values: ProtoEnumValue[];
}

export interface ProtoMessage {
    name: string;
    comment?: string;
    fields: ProtoField[];
    oneofs?: ProtoOneof[];
}

export interface ParsedProtoFile {
    messages: ProtoMessage[];
    enums: ProtoEnum[];
}

export class BackwardCompatibilityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BackwardCompatibilityError';
    }
}
