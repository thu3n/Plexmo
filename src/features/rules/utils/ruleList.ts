import type { RuleInstance, RuleSettings } from "@/features/rules/types";
import { ruleTypeLabel } from "@/features/rules/constants";

export type RuleSortKey = "name" | "type" | "enabled";

export const RULE_SORT_OPTIONS: { value: RuleSortKey; label: string }[] = [
    { value: "name", label: "Name" },
    { value: "type", label: "Type" },
    { value: "enabled", label: "Enabled first" },
];

const byName = (a: RuleInstance, b: RuleInstance) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

const COMPARATORS: Record<RuleSortKey, (a: RuleInstance, b: RuleInstance) => number> = {
    name: byName,
    type: (a, b) => ruleTypeLabel(a.type).localeCompare(ruleTypeLabel(b.type)) || byName(a, b),
    enabled: (a, b) => Number(b.enabled) - Number(a.enabled) || byName(a, b),
};

/** Case-insensitive match on name or type label, then a stable sort. */
export const filterAndSortRules = <T extends RuleInstance>(rules: T[], query: string, sort: RuleSortKey): T[] => {
    const q = query.trim().toLowerCase();
    const matched = q
        ? rules.filter((r) => r.name.toLowerCase().includes(q) || ruleTypeLabel(r.type).toLowerCase().includes(q))
        : rules;
    return [...matched].sort(COMPARATORS[sort]);
};

const COPY_SUFFIX = " (copy)";

/**
 * Unsaved clone of a persisted rule. Assignment lists are dropped here — the
 * form loads them from the source rule so the copy keeps the same scope.
 */
export const duplicateRule = (rule: RuleInstance): RuleInstance => ({
    type: rule.type,
    name: `${rule.name}${COPY_SUFFIX}`,
    enabled: rule.enabled,
    settings: JSON.parse(JSON.stringify(rule.settings)) as RuleSettings,
    discordWebhookId: null,
    discordWebhookIds: [...new Set([...(rule.discordWebhookIds ?? []), ...(rule.discordWebhookId ? [rule.discordWebhookId] : [])])],
});
