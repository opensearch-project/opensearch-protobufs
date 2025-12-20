/**
 * Reporter for tracking changes during proto merge.
 * Tracks: added, removed, type_changed, optional_change.
 */

export type ChangeType = 'added' | 'removed' | 'type_changed' | 'optional_change';

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
}

export interface EnumValueChange {
    enumName: string;
    changeType: 'added' | 'removed';
    valueName: string;
}

export class MergeReporter {
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
     * Check if there are any backward incompatible changes (optional modifier changes).
     */
    hasIncompatibleChanges(): boolean {
        return this.fieldChanges.some(c => c.changeType === 'optional_change');
    }

    /**
     * Get list of backward incompatible changes.
     */
    getIncompatibleChanges(): FieldChange[] {
        return this.fieldChanges.filter(c => c.changeType === 'optional_change');
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

        const lines: string[] = ['## Merge Report\n'];

        const byMessage = new Map<string, FieldChange[]>();
        for (const change of this.fieldChanges) {
            const list = byMessage.get(change.messageName) || [];
            list.push(change);
            byMessage.set(change.messageName, list);
        }

        if (byMessage.size > 0) {
            lines.push('### Message Changes\n');

            for (const [msgName, changes] of byMessage) {
                lines.push(`#### ${msgName}\n`);
                lines.push('| Field | Change | Details |');
                lines.push('|-------|--------|---------|');

                for (const c of changes) {
                    const details = this.formatFieldDetails(c);
                    lines.push(`| ${c.fieldName} | **${c.changeType}** | ${details} |`);
                }
                lines.push('');
            }
        }

        const byEnum = new Map<string, EnumValueChange[]>();
        for (const change of this.enumChanges) {
            const list = byEnum.get(change.enumName) || [];
            list.push(change);
            byEnum.set(change.enumName, list);
        }

        if (byEnum.size > 0) {
            lines.push('### Enum Changes\n');

            for (const [enumName, changes] of byEnum) {
                lines.push(`#### ${enumName}\n`);
                lines.push('| Value | Change |');
                lines.push('|-------|--------|');

                for (const c of changes) {
                    lines.push(`| ${c.valueName} | **${c.changeType}** |`);
                }
                lines.push('');
            }
        }

        return lines.join('\n');
    }

    private formatFieldDetails(c: FieldChange): string {
        switch (c.changeType) {
            case 'added':
                return `New field: \`${c.incomingType}\``;
            case 'removed':
                return `Deprecated: \`${c.existingType}\``;
            case 'type_changed':
                return `\`${c.existingType}\` → \`${c.incomingType}\` (versioned as \`${c.versionedName}\`)`;
            case 'optional_change':
                return `⚠️ Breaking: \`${c.existingType}\` → \`${c.incomingType}\` (versioned as \`${c.versionedName}\`)`;
            default:
                return '';
        }
    }

    clear(): void {
        this.fieldChanges = [];
        this.enumChanges = [];
    }
}
