import { describe, it, expect } from "vitest";
import type { RuleDebugResult } from "@/features/rules/types";
import { getDefaultSettings, RULE_TYPE } from "@/features/rules/constants";
import { describeRuleValue, summarizeDebugResults } from "@/features/rules/utils/debuggerLogic";

let nextId = 0;
const result = (type: string, limit: number, opts: { applies?: boolean; enabled?: boolean } = {}): RuleDebugResult => ({
    rule: {
        id: `r${++nextId}`,
        type,
        name: `${type}-${limit}`,
        enabled: opts.enabled ?? true,
        settings: { ...getDefaultSettings(type), limit },
        discordWebhookId: null,
    },
    applies: opts.applies ?? true,
    reasons: { global: true, user: false, servers: [] },
});

const statuses = (results: RuleDebugResult[]) => summarizeDebugResults(results).rows.map((r) => r.status);

describe("summarizeDebugResults", () => {
    it("picks the strictest applied stream limit and marks looser ones overridden", () => {
        const summary = summarizeDebugResults([result(RULE_TYPE.MAX_CONCURRENT, 3), result(RULE_TYPE.MAX_CONCURRENT, 2)]);
        expect(summary.effectiveStreamLimit).toBe(2);
        expect(summary.rows.map((r) => r.status)).toEqual(["overridden", "effective"]);
    });

    it("never treats a pause rule's minutes as the active stream limit", () => {
        // A 2-minute pause rule used to be flagged "Active Limit" next to a 2-stream limit.
        const summary = summarizeDebugResults([result(RULE_TYPE.MAX_CONCURRENT, 2), result(RULE_TYPE.KILL_PAUSED, 2)]);
        expect(summary.rows.map((r) => r.status)).toEqual(["effective", "applied"]);
    });

    it("reports Unlimited (null) when only non-limit rules apply", () => {
        const summary = summarizeDebugResults([result(RULE_TYPE.KILL_PAUSED, 1), result(RULE_TYPE.SCHEDULED, 1)]);
        expect(summary.effectiveStreamLimit).toBeNull();
        expect(summary.activeRuleCount).toBe(2);
        expect(summary.rows.every((r) => r.status === "applied")).toBe(true);
    });

    it("excludes disabled and out-of-scope rules from the effective limit", () => {
        const rows = [
            result(RULE_TYPE.MAX_CONCURRENT, 1, { enabled: false }),
            result(RULE_TYPE.MAX_CONCURRENT, 1, { applies: false }),
            result(RULE_TYPE.MAX_CONCURRENT, 4),
        ];
        expect(summarizeDebugResults(rows).effectiveStreamLimit).toBe(4);
        expect(statuses(rows)).toEqual(["disabled", "mismatch", "effective"]);
    });
});

describe("describeRuleValue", () => {
    it("labels each rule type in its own unit", () => {
        expect(describeRuleValue(result(RULE_TYPE.MAX_CONCURRENT, 2).rule)).toBe("Limit: 2 streams");
        expect(describeRuleValue(result(RULE_TYPE.KILL_PAUSED, 1).rule)).toBe("Paused longer than 1 minute");
        expect(describeRuleValue(result(RULE_TYPE.SCHEDULED, 1).rule)).toBe("Block schedule · 1 window");
    });
});
