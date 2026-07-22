// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isCacheableShellResponse } from "@/lib/sw/navigation";

const shellResponse = (overrides: Partial<{ ok: boolean; redirected: boolean; url: string }> = {}) => ({
    ok: true,
    redirected: false,
    url: "https://plexmo.example/",
    ...overrides,
});

describe("isCacheableShellResponse", () => {
    it("accepts a 200 non-redirected shell response", () => {
        expect(isCacheableShellResponse(shellResponse())).toBe(true);
    });

    it("rejects followed redirects (logged-out 307 -> /login)", () => {
        expect(
            isCacheableShellResponse(
                shellResponse({ redirected: true, url: "https://plexmo.example/login" }),
            ),
        ).toBe(false);
    });

    it("rejects responses whose final path is not the shell", () => {
        expect(
            isCacheableShellResponse(shellResponse({ url: "https://plexmo.example/setup" })),
        ).toBe(false);
    });

    it("rejects non-ok responses", () => {
        expect(isCacheableShellResponse(shellResponse({ ok: false }))).toBe(false);
    });
});

// Tripwire against the 2026-07-18 regression class: a top-level navigation must
// never receive a redirected Response (kicks iOS installed PWAs out of
// standalone mode), and cache writes must be tied to the event lifetime.
describe("navigation module invariants", () => {
    const source = readFileSync("src/lib/sw/navigation.ts", "utf-8");

    it("strips the redirected flag via copyResponse", () => {
        expect(source).toMatch(/copyResponse/);
        expect(source).toMatch(/response\.redirected \? await copyResponse\(response\)/);
    });

    it("refuses to cache redirected or non-200 responses", () => {
        expect(source).toMatch(/response\.redirected \|\| response\.status !== 200 \? null/);
    });

    it("ties background cache work to the event lifetime", () => {
        expect(source).toMatch(/waitUntil\(done\)/);
    });
});
