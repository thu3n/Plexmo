// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { probePlexServer } from "@/lib/server-probe";
import { healthFromProbe, disabledHealth } from "@/lib/server-health";

const ROOT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer size="1" friendlyName="Basement" platform="Linux" version="1.41.3.9314-a0bfb8370" machineIdentifier="abc"></MediaContainer>`;

const mockFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) => {
    const fn = vi.fn(impl);
    vi.stubGlobal("fetch", fn);
    return fn;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("probePlexServer", () => {
    it("probes the authenticated root (not /identity) with the token in a header", async () => {
        const fetchMock = mockFetch(async () => new Response(ROOT_XML, { status: 200 }));
        const result = await probePlexServer({ baseUrl: "http://plex.local:32400/", token: "tok" });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://plex.local:32400/");
        expect(url).not.toContain("tok");
        expect((init.headers as Record<string, string>)["X-Plex-Token"]).toBe("tok");
        expect(result).toMatchObject({ ok: true, version: "1.41.3.9314-a0bfb8370", platform: "Linux", friendlyName: "Basement" });
    });

    it("reports a wrong token as unauthorized", async () => {
        mockFetch(async () => new Response("<html>401</html>", { status: 401, statusText: "Unauthorized" }));
        const result = await probePlexServer({ baseUrl: "http://plex.local:32400", token: "bad" });
        expect(result).toMatchObject({ ok: false, reason: "unauthorized" });
    });

    it("reports a hung server as a timeout", async () => {
        mockFetch(
            (_url, init) =>
                new Promise((_, reject) => {
                    init.signal?.addEventListener("abort", () =>
                        reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
                    );
                })
        );
        const result = await probePlexServer({ baseUrl: "http://plex.local:32400", token: "t" }, 10);
        expect(result).toMatchObject({ ok: false, reason: "timeout" });
    });

    it("reports connection refused as unreachable with an English hint", async () => {
        mockFetch(async () => {
            throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
        });
        const result = await probePlexServer({ baseUrl: "http://plex.local", token: "t" });
        expect(result).toMatchObject({ ok: false, reason: "unreachable" });
        expect(!result.ok && result.message).toMatch(/Connection refused/);
    });

    it("rejects non-http URLs without fetching", async () => {
        const fetchMock = mockFetch(async () => new Response(ROOT_XML));
        const result = await probePlexServer({ baseUrl: "file:///etc", token: "t" });
        expect(result.ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("server health mapping", () => {
    const now = new Date("2026-09-28T12:00:00Z");

    it("marks an unauthorized probe distinctly from unreachable", () => {
        const h = healthFromProbe("s", { ok: false, reason: "unauthorized", message: "nope", latencyMs: 5 }, undefined, now);
        expect(h.state).toBe("unauthorized");
        const u = healthFromProbe("s", { ok: false, reason: "timeout", message: "slow", latencyMs: null }, undefined, now);
        expect(u.state).toBe("unreachable");
    });

    it("keeps the last cron sighting for a paused server", () => {
        const h = disabledHealth("s", now.getTime() - 60_000, now);
        expect(h).toMatchObject({ state: "disabled", lastSeenAt: "2026-09-28T11:59:00.000Z" });
    });
});
