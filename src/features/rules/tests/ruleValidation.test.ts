import { describe, it, expect } from "vitest";
import type { RuleInstance } from "@/features/rules/types";
import { getDefaultSettings, LIMIT_BOUNDS, RULE_TYPE } from "@/features/rules/constants";
import {
    firstErrorField,
    parseLimitInput,
    tabForError,
    validateRuleForm,
} from "@/features/rules/utils/ruleValidation";

const makeRule = (type: string, overrides: Partial<RuleInstance> = {}): RuleInstance => ({
    type,
    name: "Rule",
    enabled: true,
    settings: getDefaultSettings(type),
    discordWebhookId: null,
    ...overrides,
});

describe("parseLimitInput", () => {
    it("accepts plain integers", () => {
        expect(parseLimitInput("3")).toBe(3);
        expect(parseLimitInput(" 12 ")).toBe(12);
    });

    it.each(["", "  ", "1.5", "-2", "1e3", "abc"])("rejects %j", (raw) => {
        expect(parseLimitInput(raw)).toBeNull();
    });
});

describe("validateRuleForm", () => {
    it("passes a valid concurrent-stream rule", () => {
        expect(validateRuleForm(makeRule(RULE_TYPE.MAX_CONCURRENT), "2")).toEqual({});
    });

    it("requires a non-blank name", () => {
        const errors = validateRuleForm(makeRule(RULE_TYPE.MAX_CONCURRENT, { name: "   " }), "2");
        expect(errors.name).toBeDefined();
    });

    it("rejects a cleared limit instead of coercing it to 1", () => {
        expect(validateRuleForm(makeRule(RULE_TYPE.MAX_CONCURRENT), "").limit).toBeDefined();
    });

    it("enforces per-type min/max bounds", () => {
        const { min, max } = LIMIT_BOUNDS[RULE_TYPE.KILL_PAUSED];
        const rule = makeRule(RULE_TYPE.KILL_PAUSED);
        expect(validateRuleForm(rule, String(min - 1)).limit).toBeDefined();
        expect(validateRuleForm(rule, String(max + 1)).limit).toBeDefined();
        expect(validateRuleForm(rule, String(max)).limit).toBeUndefined();
    });

    it("ignores the limit field for scheduled access", () => {
        expect(validateRuleForm(makeRule(RULE_TYPE.SCHEDULED), "").limit).toBeUndefined();
    });

    it("requires at least one schedule window with days", () => {
        const noWindows = makeRule(RULE_TYPE.SCHEDULED);
        noWindows.settings = { ...noWindows.settings, schedule: { type: "block", timeWindows: [] } };
        expect(validateRuleForm(noWindows, "1").schedule).toBeDefined();

        const noDays = makeRule(RULE_TYPE.SCHEDULED);
        noDays.settings = {
            ...noDays.settings,
            schedule: { type: "block", timeWindows: [{ startTime: "22:00", endTime: "07:00", days: [] }] },
        };
        expect(validateRuleForm(noDays, "1").schedule).toBeDefined();
    });
});

describe("error navigation", () => {
    it("focuses the first field in form order and maps it to its tab", () => {
        const errors = validateRuleForm(makeRule(RULE_TYPE.MAX_CONCURRENT, { name: "" }), "");
        expect(firstErrorField(errors)).toBe("name");
        expect(tabForError("name")).toBe("config");
        expect(firstErrorField({})).toBeNull();
    });
});
