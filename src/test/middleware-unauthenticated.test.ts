/**
 * Middleware responses for unauthenticated requests. An API fetch must get
 * machine-readable 401 JSON — a 307 to /login is followed silently by
 * fetch(), handing the login page's HTML to res.json(), which WebKit surfaces
 * as the cryptic "The string did not match the expected pattern" (seen on iOS
 * PWA cold opens, where the service worker serves the cached shell to a
 * logged-out client). Page navigations keep the redirect.
 */
import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/jwt", () => ({ verifyToken: vi.fn(async () => null) }));

import { middleware } from "@/middleware";

const makeRequest = (pathname: string, cookies: Record<string, string> = {}) =>
    ({
        nextUrl: { pathname },
        url: `http://127.0.0.1:3000${pathname}`,
        method: "GET",
        cookies: {
            get: (name: string) =>
                cookies[name] === undefined ? undefined : { name, value: cookies[name] },
        },
    }) as unknown as NextRequest;

// Setup cookie present: middleware trusts it and never dials /api/setup/status.
const CONFIGURED = { plexmo_setup_complete: "true" };

describe("middleware unauthenticated responses", () => {
    it("returns 401 JSON for API calls without a session", async () => {
        const res = await middleware(makeRequest("/api/dashboard", CONFIGURED));
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 JSON when the token is present but unverifiable", async () => {
        const res = await middleware(
            makeRequest("/api/dashboard", { ...CONFIGURED, token: "expired" }),
        );
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("still redirects page navigations to /login", async () => {
        const res = await middleware(makeRequest("/history", CONFIGURED));
        expect(res.status).toBeGreaterThanOrEqual(300);
        expect(res.status).toBeLessThan(400);
        expect(res.headers.get("location")).toContain("/login");
    });

    it("passes public API paths through untouched", async () => {
        const res = await middleware(makeRequest("/api/auth/me", CONFIGURED));
        expect(res.status).toBe(200);
        expect(res.headers.get("location")).toBeNull();
    });
});
