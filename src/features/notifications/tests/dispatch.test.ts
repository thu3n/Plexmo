import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { buildEmbed, selectTargets } from "@/lib/notifications/dispatch";
import { maskWebhookUrl, type DiscordWebhook } from "@/lib/notifications/webhook-store";
import { parseWebhookInput } from "@/lib/notifications/webhook-input";
import { sanitizeFailureReason } from "@/lib/notifications/monitor";
import { DISCORD_LIMITS } from "../lib/templates";
import type { NotificationEventId } from "../lib/events";

const hook = (id: string, events: NotificationEventId[], enabled = true): DiscordWebhook => ({
    id,
    name: id,
    url: `https://discord.com/api/webhooks/${id}/secret`,
    events,
    enabled,
    createdAt: "",
});

describe("selectTargets", () => {
    const hooks = [hook("a", ["start", "stop"]), hook("b", ["rule_violation"]), hook("c", ["start"], false), hook("d", [])];

    it("filters by subscribed event and enabled flag", () => {
        expect(selectTargets(hooks, "start").map((w) => w.id)).toEqual(["a"]);
        expect(selectTargets(hooks, "pause")).toEqual([]);
    });

    it("adds a rule's own webhooks once, but never disabled ones", () => {
        expect(selectTargets(hooks, "rule_violation", ["d", "b", "c"]).map((w) => w.id)).toEqual(["b", "d"]);
    });

    it("sends tests to every enabled webhook", () => {
        expect(selectTargets(hooks, "test").map((w) => w.id)).toEqual(["a", "b", "d"]);
    });
});

describe("buildEmbed", () => {
    it("uses the override, event colour and clamps field values", () => {
        const embed = buildEmbed(
            "pause",
            { user: "Alice", title: "Dune" },
            [{ name: "Device", value: "x".repeat(2000) }],
            { pause: { title: "{user} paused", description: "{title}" } }
        );
        expect(embed.title).toBe("Alice paused");
        expect(embed.description).toBe("Dune");
        expect(embed.fields![0].value.length).toBe(DISCORD_LIMITS.fieldValue);
    });
});

describe("webhook secrets", () => {
    it("masks everything but the host", () => {
        expect(maskWebhookUrl("https://discord.com/api/webhooks/123/abc")).toBe("discord.com/••••••");
    });

    it("keeps the stored URL on update when the URL is blank, requires it on create", () => {
        const parsed = parseWebhookInput({ name: "x", url: " ", events: ["start"], enabled: true }, { requireUrl: false });
        expect(parsed.ok).toBe(true);
        expect(parsed.ok && parsed.input.url).toBeUndefined();
        expect(parseWebhookInput({ name: "x", url: "", events: [] }, { requireUrl: true }).ok).toBe(false);
    });

    it("redacts Plex tokens from failure reasons", () => {
        expect(sanitizeFailureReason("fetch http://h/status?X-Plex-Token=abc123&x=1 failed")).toBe(
            "fetch http://h/status?X-Plex-Token=[redacted]&x=1 failed"
        );
    });
});
