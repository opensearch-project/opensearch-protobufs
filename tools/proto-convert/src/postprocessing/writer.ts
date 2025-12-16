/**
 * Writer module: Generate .proto file output using Mustache templates.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { render } from 'mustache';
import { ProtoMessage, ProtoEnum } from './types';

const TEMPLATE = readFileSync(join(__dirname, 'templates', 'proto.mustache'), 'utf8');

/**
 * Split a comment into lines for template rendering.
 */
function splitComment(comment: string | undefined): string[] | undefined {
    if (!comment) return undefined;
    return comment.split('\n');
}

/**
 * Prepare message data for Mustache template rendering.
 */
export function prepareMessageData(msg: ProtoMessage): object {
    return {
        isMessage: true,
        name: msg.name,
        commentLines: splitComment(msg.comment),
        fields: msg.fields.map(f => ({
            ...f,
            commentLines: splitComment(f.comment),
            hasAnnotations: f.annotations && f.annotations.length > 0,
            annotations: f.annotations?.map(a => `${a.name} = ${a.value}`).join(', ')
        })),
        oneofs: msg.oneofs?.map(oneof => ({
            name: oneof.name,
            commentLines: splitComment(oneof.comment),
            fields: oneof.fields.map(f => ({
                ...f,
                commentLines: splitComment(f.comment),
                hasAnnotations: f.annotations && f.annotations.length > 0,
                annotations: f.annotations?.map(a => `${a.name} = ${a.value}`).join(', ')
            }))
        }))
    };
}

/**
 * Prepare enum data for Mustache template rendering.
 */
export function prepareEnumData(protoEnum: ProtoEnum): object {
    return {
        isEnum: true,
        name: protoEnum.name,
        commentLines: splitComment(protoEnum.comment),
        values: protoEnum.values.map(v => ({
            ...v,
            hasAnnotations: v.annotations && v.annotations.length > 0,
            annotations: v.annotations?.map(a => `${a.name} = ${a.value}`).join(', ')
        }))
    };
}

/**
 * Generate proto message string from internal type.
 */
export function generateMessage(msg: ProtoMessage): string {
    const data = prepareMessageData(msg);
    return render(TEMPLATE, data).trimEnd();
}

/**
 * Generate proto enum string from internal type.
 */
export function generateEnum(protoEnum: ProtoEnum): string {
    const data = prepareEnumData(protoEnum);
    return render(TEMPLATE, data).trimEnd();
}
