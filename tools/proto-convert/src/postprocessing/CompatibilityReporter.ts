import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Reporter for tracking changes during proto merge.
 * Tracks: added, removed, type_changed, optional_change, oneof_change.
 */

export type ChangeType = 'ADDED' | 'REMOVED' | 'TYPE CHANGED' | 'OPTIONAL CHANGE' | 'ONEOF CHANGE';

/** Format a field for report display */
export function formatField(f: { name: string; type: string; modifier?: string; number?: number; deprecated?: boolean }): string {
    const mod = f.modifier ? `${f.modifier} ` : '';
    const num = f.number !== undefined ? ` = ${f.number}` : '';
    const dep = f.deprecated ? ' [deprecated = true]' : '';
    return `${mod}${f.type} ${f.name}${num}${dep}`;
}

export interface FieldChange {
    messageName: string;
    changeType: ChangeType;
    fieldName: string;
    existingType?: string;
    incomingType?: string;
    versionedName?: string;
    versionedNumber?: number;
    existingLocation?: string;
    incomingLocation?: string;
}

export interface EnumValueChange {
    enumName: string;
    changeType: 'ADDED' | 'REMOVED';
    valueName: string;
}

export class CompatibilityReporter {
    private fieldChanges: FieldChange[] = [];
    private enumChanges: EnumValueChange[] = [];

    addFieldChange(change: FieldChange): void {
        this.fieldChanges.push(change);
    }

    addEnumChange(change: EnumValueChange): void {
        this.enumChanges.push(change);
    }

    hasChanges(): boolean {
        return this.fieldChanges.length > 0 || this.enumChanges.length > 0;
    }

    /**
     * Check if there are any backward incompatible changes (optional or oneof changes).
     */
    hasIncompatibleChanges(): boolean {
        return this.fieldChanges.some(c =>
            c.changeType === 'OPTIONAL CHANGE' || c.changeType === 'ONEOF CHANGE'
        );
    }

    /**
     * Get list of backward incompatible changes.
     */
    getIncompatibleChanges(): FieldChange[] {
        return this.fieldChanges.filter(c =>
            c.changeType === 'OPTIONAL CHANGE' || c.changeType === 'ONEOF CHANGE'
        );
    }

    getFieldChanges(): FieldChange[] {
        return this.fieldChanges;
    }

    getEnumChanges(): EnumValueChange[] {
        return this.enumChanges;
    }

    /**
     * Generate markdown report.
     */
    toMarkdown(): string {
        if (!this.hasChanges()) {
            return '## Merge Report\n\nNo changes detected.\n';
        }

        const sections: string[] = ['## Merge Report\n'];

        // Group field changes by message
        const byMessage = this.groupBy(this.fieldChanges, c => c.messageName);
        if (byMessage.size > 0) {
            sections.push(this.formatMessageChanges(byMessage));
        }

        // Group enum changes by enum
        const byEnum = this.groupBy(this.enumChanges, c => c.enumName);
        if (byEnum.size > 0) {
            sections.push(this.formatEnumChanges(byEnum));
        }

        // Add legend
        sections.push(this.formatLegend());

        return sections.join('\n');
    }

    private formatLegend(): string {
        return `### Legend

- 🗑️ **DEPRECATED** - Field/value annotated as deprecated in protobufs and will be officially removed in the next major OpenSearch release
- ➕ **ADDED** - New field/value added at the end of the message/enum
- 🚨 **BREAKING** - This change will cause breaking change to Protobuf`;
    }

    private groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
        const map = new Map<K, T[]>();
        for (const item of items) {
            const key = keyFn(item);
            const list = map.get(key) || [];
            list.push(item);
            map.set(key, list);
        }
        return map;
    }

    private formatMessageChanges(byMessage: Map<string, FieldChange[]>): string {
        const rows = Array.from(byMessage.entries())
            .flatMap(([, changes]) => changes.flatMap(c => this.formatChangeRows(c)))
            .join('\n');
        return `### Message Changes\n\n| Message | Change | Field |\n|---------|--------|-------|\n${rows}`;
    }

    private formatChangeRows(c: FieldChange): string[] {
        if (c.changeType === 'TYPE CHANGED') {
            const versionedField = c.incomingType?.replace(c.fieldName, c.versionedName || c.fieldName);
            return [
                `| ${c.messageName} | 🗑️ **DEPRECATED** | \`${c.existingType}\` |`,
                `| ${c.messageName} | ➕ **ADDED** | \`${versionedField}\` |`
            ];
        }
        return [`| ${c.messageName} | ${this.formatChangeType(c.changeType)} | ${this.formatField(c)} |`];
    }

    private formatField(c: FieldChange): string {
        switch (c.changeType) {
            case 'ADDED':
                return `\`${c.incomingType}\``;
            case 'REMOVED':
                return `\`${c.existingType}\``;
            case 'OPTIONAL CHANGE':
                return `\`${c.existingType}\` → \`${c.incomingType}\``;
            case 'ONEOF CHANGE':
                return `\`${c.fieldName}\` (moved from \`${c.existingLocation}\` to \`${c.incomingLocation}\`)`;
            default:
                return '';
        }
    }

    private formatChangeType(changeType: ChangeType | 'ADDED' | 'REMOVED'): string {
        switch (changeType) {
            case 'ADDED':
                return '➕ **ADDED**';
            case 'REMOVED':
                return '🗑️ **REMOVED**';
            case 'OPTIONAL CHANGE':
                return '🚨 **BREAKING**';
            case 'ONEOF CHANGE':
                return '🚨 **BREAKING**';
            default:
                return `**${changeType}**`;
        }
    }

    private formatEnumChanges(byEnum: Map<string, EnumValueChange[]>): string {
        const rows = Array.from(byEnum.entries())
            .flatMap(([, changes]) => changes.map(c =>
                `| ${c.enumName} | ${this.formatChangeType(c.changeType)} | \`${c.valueName}\` |`
            ))
            .join('\n');
        return `### Enum Changes\n\n| Enum | Change | Value |\n|------|--------|-------|\n${rows}`;
    }

    clear(): void {
        this.fieldChanges = [];
        this.enumChanges = [];
    }

    /**
     * Write the markdown report to a file.
     * @param path Optional file path. Defaults to /tmp/merge-report.md
     * @returns The path where the report was written
     */
    writeToFile(path?: string): string {
        const reportPath = path ?? join(tmpdir(), 'merge-report.md');
        writeFileSync(reportPath, this.toMarkdown());
        return reportPath;
    }
}
