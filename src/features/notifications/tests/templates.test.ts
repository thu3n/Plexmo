import { describe, it, expect } from "vitest";
import {
    DISCORD_LIMITS,
    clampText,
    renderMessage,
    renderTemplate,
    resolveTemplate,
    sanitizeTemplates,
} from "../lib/templates";
import { getEventDefinition } from "../lib/events";

describe("renderTemplate", () => {
    it("substitutes known placeholders", () => {
        expect(renderTemplate("{user} watches {title} on {server}", { user: "Alice", title: "Dune", server: "Home" }))
            .toBe("Alice watches Dune on Home");
    });

    it("renders known-but-missing placeholders as Unknown and leaves unknown names verbatim", () => {
        expect(renderTemplate("{user} {reason} {nope}", { user: "Alice" })).toBe("Alice Unknown {nope}");
    });

    it("does not re-expand placeholders contained in values", () => {
        expect(renderTemplate("{user} / {title}", { user: "{title}", title: "Dune" })).toBe("{title} / Dune");
    });

    it("treats blank values as missing", () => {
        expect(renderTemplate("[{player}]", { player: "   " })).toBe("[Unknown]");
    });
});

describe("clampText", () => {
    it("leaves short text alone and marks truncation", () => {
        expect(clampText("abc", 5)).toBe("abc");
        const out = clampText("abcdefgh", 5);
        expect(out).toHaveLength(5);
        expect(out.endsWith("…")).toBe(true);
    });
});

describe("resolveTemplate / renderMessage", () => {
    it("falls back to the default for missing or blank overrides", () => {
        expect(resolveTemplate("start", {})).toEqual(getEventDefinition("start").defaultTemplate);
        expect(resolveTemplate("start", { start: { title: " ", description: "x {user}" } })).toEqual({
            title: getEventDefinition("start").defaultTemplate.title,
            description: "x {user}",
        });
    });

    it("clamps rendered output to Discord embed limits", () => {
        const huge = "x".repeat(DISCORD_LIMITS.description + 50);
        const msg = renderMessage("stop", { user: huge }, { stop: { title: "{user}", description: "{user}{user}" } });
        expect(msg.title.length).toBe(DISCORD_LIMITS.title);
        expect(msg.description.length).toBe(DISCORD_LIMITS.description);
    });
});

describe("sanitizeTemplates", () => {
    it("drops unknown events and malformed entries and caps lengths", () => {
        const result = sanitizeTemplates({
            start: { title: "t".repeat(1000), description: "d" },
            bogus: { title: "x", description: "y" },
            stop: { title: 5, description: "y" },
            pause: "nope",
        });
        expect(Object.keys(result)).toEqual(["start"]);
        expect(result.start!.title).toHaveLength(DISCORD_LIMITS.title);
    });

    it("returns empty for non-objects", () => {
        expect(sanitizeTemplates(null)).toEqual({});
        expect(sanitizeTemplates([1, 2])).toEqual({});
        expect(sanitizeTemplates("x")).toEqual({});
    });
});
