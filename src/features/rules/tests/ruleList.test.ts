import { describe, it, expect } from "vitest";
import type { RuleInstance } from "@/features/rules/types";
import { getDefaultSettings, RULE_TYPE } from "@/features/rules/constants";
import { duplicateRule, filterAndSortRules } from "@/features/rules/utils/ruleList";

const rule = (name: string, type: string, enabled = true): RuleInstance & { id: string } => ({
    id: name,
    name,
    type,
    enabled,
    settings: getDefaultSettings(type),
    discordWebhookId: null,
});

const rules = [
    rule("bravo", RULE_TYPE.SCHEDULED, false),
    rule("Alpha", RULE_TYPE.MAX_CONCURRENT, false),
    rule("charlie", RULE_TYPE.KILL_PAUSED, true),
];

describe("filterAndSortRules", () => {
    it("sorts by name case-insensitively", () => {
        expect(filterAndSortRules(rules, "", "name").map((r) => r.name)).toEqual(["Alpha", "bravo", "charlie"]);
    });

    it("sorts enabled rules first", () => {
        expect(filterAndSortRules(rules, "", "enabled")[0].name).toBe("charlie");
    });

    it("sorts by type label", () => {
        expect(filterAndSortRules(rules, "", "type").map((r) => r.type)).toEqual([
            RULE_TYPE.KILL_PAUSED,
            RULE_TYPE.MAX_CONCURRENT,
            RULE_TYPE.SCHEDULED,
        ]);
    });

    it("matches on name or type label", () => {
        expect(filterAndSortRules(rules, "ALPH", "name").map((r) => r.name)).toEqual(["Alpha"]);
        expect(filterAndSortRules(rules, "scheduled", "name").map((r) => r.name)).toEqual(["bravo"]);
    });
});

describe("duplicateRule", () => {
    it("produces an unsaved deep copy", () => {
        const source = { ...rule("Kids", RULE_TYPE.SCHEDULED), discordWebhookIds: ["w1"] };
        const copy = duplicateRule(source);
        expect(copy.id).toBeUndefined();
        expect(copy.name).toBe("Kids (copy)");
        expect(copy.discordWebhookIds).toEqual(["w1"]);
        copy.settings.schedule!.timeWindows[0].days.push(0);
        expect(source.settings.schedule!.timeWindows[0].days).not.toContain(0);
    });
});
