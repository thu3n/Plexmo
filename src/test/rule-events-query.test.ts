import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getRecentRuleEvents } from "@/lib/rules/rule-events-query";

const RULE = "rule-1";

beforeAll(() => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt) VALUES ('srv', 'Basement', 'http://x', 't', ?, ?)").run(now, now);
    db.prepare("INSERT INTO user_identities (accountId, username, title, createdAt, updatedAt) VALUES ('100', 'elias', 'elias', ?, ?)").run(now, now);
    const insert = db.prepare("INSERT INTO rule_events (ruleKey, userId, triggeredAt, endedAt, details, serverId) VALUES (?, ?, ?, ?, ?, ?)");
    insert.run(RULE, "100", "2026-01-01T10:00:00.000Z", "2026-01-01T10:05:00.000Z", JSON.stringify({ count: 3, limit: 2, enforced: true }), "srv");
    insert.run(RULE, "999", "2026-01-02T10:00:00.000Z", null, "not json", null);
    insert.run("other-rule", "100", "2026-01-03T10:00:00.000Z", null, "{}", null);
});

describe("getRecentRuleEvents", () => {
    it("returns only this rule's events, newest first, with names joined", () => {
        const events = getRecentRuleEvents(RULE, 10);
        expect(events.map((e) => e.userId)).toEqual(["999", "100"]);

        const [unknownUser, enforced] = events;
        expect(enforced).toMatchObject({ username: "elias", serverName: "Basement", enforced: true, count: 3, limit: 2 });
        // Unparseable legacy details and unknown users degrade to nulls, not errors.
        expect(unknownUser).toMatchObject({ username: null, serverName: null, enforced: false, count: null, endedAt: null });
    });

    it("honours the limit", () => {
        expect(getRecentRuleEvents(RULE, 1)).toHaveLength(1);
    });
});
