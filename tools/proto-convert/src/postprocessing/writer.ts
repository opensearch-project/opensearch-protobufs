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
            hasOptions: f.options && f.options.length > 0,
            options: f.options?.map(o => `${o.name} = ${o.value}`).join(', ')
        })),
        oneofs: msg.oneofs?.map(oneof => ({
            name: oneof.name,
            commentLines: splitComment(oneof.comment),
            fields: oneof.fields.map(f => ({
                ...f,
                commentLines: splitComment(f.comment),
                hasOptions: f.options && f.options.length > 0,
                options: f.options?.map(o => `${o.name} = ${o.value}`).join(', ')
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
            hasOptions: v.options && v.options.length > 0,
            options: v.options?.map(o => `${o.name} = ${o.value}`).join(', ')
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
