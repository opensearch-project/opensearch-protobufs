import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Reporter for tracking changes during proto merge.
 * Tracks: added, removed, type_changed, optional_change, oneof_change.
 */

export type ChangeType = 'ADDED' | 'REMOVED' | 'TYPE CHANGED' | 'OPTIONAL CHANGE' | 'ONEOF CHANGE';

/** Format a field for report display */
export function formatField(f: { name: string; type: string; modifier?: string }): string {
    const mod = f.modifier ? `${f.modifier} ` : '';
    return `${mod}${f.type} ${f.name}`;
}

export interface FieldChange {
    messageName: string;
    changeType: ChangeType;
    fieldName: string;
    existingType?: string;
    incomingType?: string;
    versionedName?: string;
    existingLocation?: string;  // 'regular' or oneof name
    incomingLocation?: string;  // 'regular' or oneof name
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

        return sections.join('\n');
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
        const tables = Array.from(byMessage.entries()).map(([msgName, changes]) => {
            const rows = changes.map(c =>
                `| ${c.fieldName} | **${c.changeType}** | ${this.formatFieldDetails(c)} |`
            ).join('\n');
            return `#### ${msgName}\n\n| Field | Change | Details |\n|-------|--------|---------|
${rows}`;
        });
        return `### Message Changes\n\n${tables.join('\n\n')}`;
    }

    private formatEnumChanges(byEnum: Map<string, EnumValueChange[]>): string {
        const tables = Array.from(byEnum.entries()).map(([enumName, changes]) => {
            const rows = changes.map(c =>
                `| ${c.valueName} | **${c.changeType}** |`
            ).join('\n');
            return `#### ${enumName}\n\n| Value | Change |\n|-------|--------|\n${rows}`;
        });
        return `### Enum Changes\n\n${tables.join('\n\n')}`;
    }

    private formatFieldDetails(c: FieldChange): string {
        switch (c.changeType) {
            case 'ADDED':
                return `New field: \`${c.incomingType}\``;
            case 'REMOVED':
                return `Deprecated: \`${c.existingType}\``;
            case 'TYPE CHANGED':
                return `\`${c.existingType}\` → \`${c.incomingType}\` (versioned as \`${c.versionedName}\`)`;
            case 'OPTIONAL CHANGE':
                return `⚠️ Breaking: \`${c.existingType}\` → \`${c.incomingType}\``;
            case 'ONEOF CHANGE':
                return `⚠️ Breaking: moved from \`${c.existingLocation}\` to \`${c.incomingLocation}\``;
            default:
                return '';
        }
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
