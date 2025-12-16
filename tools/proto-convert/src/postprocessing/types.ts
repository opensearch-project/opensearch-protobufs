/**
 * Internal types for proto processing.
 */

export interface Annotation {
    name: string;
    value: string;
}

export interface ProtoField {
    name: string;
    type: string;
    number: number;
    modifier?: string;  // 'optional' | 'repeated'
    comment?: string;
    annotations?: Annotation[];
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
    annotations?: Annotation[];
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
