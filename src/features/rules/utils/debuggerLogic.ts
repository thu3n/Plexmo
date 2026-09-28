import type { RuleDebugResult, RuleInstance } from "@/features/rules/types";
import { RULE_TYPE } from "@/features/rules/constants";

/**
 * - effective:   the strictest applied stream limit — the one actually enforced
 * - overridden:  an applied stream limit that a stricter one supersedes
 * - applied:     an applied rule of a type that does not compete on limits
 * - mismatch:    enabled, but the user is outside its scope
 * - disabled:    the rule is turned off
 */
export type DebugRowStatus = "effective" | "overridden" | "applied" | "mismatch" | "disabled";

export interface DebugRow {
    result: RuleDebugResult;
    status: DebugRowStatus;
    valueLabel: string | null;
}

export interface DebugSummary {
    /** Strictest applied concurrent-stream limit; null when none applies. */
    effectiveStreamLimit: number | null;
    activeRuleCount: number;
    rows: DebugRow[];
}

const isApplied = (r: RuleDebugResult): boolean => r.applies && r.rule.enabled;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Human-readable setting for the rule's own type (never "streams" for a pause rule). */
export const describeRuleValue = (rule: RuleInstance): string | null => {
    switch (rule.type) {
        case RULE_TYPE.MAX_CONCURRENT:
            return `Limit: ${plural(rule.settings.limit, "stream", "streams")}`;
        case RULE_TYPE.KILL_PAUSED:
            return `Paused longer than ${plural(rule.settings.limit, "minute", "minutes")}`;
        case RULE_TYPE.SCHEDULED: {
            const schedule = rule.settings.schedule;
            if (!schedule) return null;
            const mode = schedule.type === "allow" ? "Allow" : "Block";
            return `${mode} schedule · ${plural(schedule.timeWindows.length, "window", "windows")}`;
        }
        default:
            return null;
    }
};

export const summarizeDebugResults = (results: RuleDebugResult[]): DebugSummary => {
    const applied = results.filter(isApplied);
    const streamLimits = applied
        .filter((r) => r.rule.type === RULE_TYPE.MAX_CONCURRENT)
        .map((r) => r.rule.settings.limit);
    const effectiveStreamLimit = streamLimits.length > 0 ? Math.min(...streamLimits) : null;

    const statusOf = (r: RuleDebugResult): DebugRowStatus => {
        if (!r.rule.enabled) return "disabled";
        if (!r.applies) return "mismatch";
        if (r.rule.type !== RULE_TYPE.MAX_CONCURRENT) return "applied";
        return r.rule.settings.limit === effectiveStreamLimit ? "effective" : "overridden";
    };

    return {
        effectiveStreamLimit,
        activeRuleCount: applied.length,
        rows: results.map((result) => ({
            result,
            status: statusOf(result),
            valueLabel: describeRuleValue(result.rule),
        })),
    };
};
