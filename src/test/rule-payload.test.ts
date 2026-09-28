import { describe, it, expect } from "vitest";
import { RULE_TYPE } from "@/features/rules/constants";
import {
    validateAssignments,
    validateRuleName,
    validateRuleSettings,
    validateRuleType,
} from "@/lib/rules/rule-payload";

describe("rule payload validation", () => {
    it("trims names and rejects blank ones", () => {
        expect(validateRuleName("  Kids  ")).toEqual({ ok: true, value: "Kids" });
        expect(validateRuleName("   ").ok).toBe(false);
        expect(validateRuleName(42).ok).toBe(false);
    });

    it("only accepts known rule types", () => {
        expect(validateRuleType(RULE_TYPE.SCHEDULED).ok).toBe(true);
        expect(validateRuleType("bandwidth_limit").ok).toBe(false);
    });

    it("bounds the limit per type", () => {
        expect(validateRuleSettings(RULE_TYPE.MAX_CONCURRENT, { limit: 0 }).ok).toBe(false);
        expect(validateRuleSettings(RULE_TYPE.MAX_CONCURRENT, { limit: 1.5 }).ok).toBe(false);
        expect(validateRuleSettings(RULE_TYPE.MAX_CONCURRENT, { limit: 2 }).ok).toBe(true);
        expect(validateRuleSettings(RULE_TYPE.SCHEDULED, { limit: 0 }).ok).toBe(true);
    });

    it("treats missing assignments as 'leave untouched' and rejects malformed ones", () => {
        expect(validateAssignments(undefined)).toEqual({ ok: true, value: undefined });
        expect(validateAssignments({ userIds: ["1"] })).toEqual({ ok: true, value: { userIds: ["1"], serverIds: [] } });
        expect(validateAssignments({ userIds: [1] }).ok).toBe(false);
    });
});
