import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { isOwnerLike, resolveScope, type AccessScope } from "@/lib/authz";
import { isOnboardingAllowedApi } from "@/lib/onboarding-allowlist";

const scope = (role: AccessScope["role"]): { scope: AccessScope } => ({
    scope: { role, serverIds: "all" },
});

describe("isOwnerLike (requireOwner policy)", () => {
    it("allows owner, setup and api-key scopes", () => {
        expect(isOwnerLike(scope("owner"))).toBe(true);
        expect(isOwnerLike(scope("setup"))).toBe(true);
        expect(isOwnerLike(scope("api"))).toBe(true);
    });

    it("denies viewers (incl. Plex-reported admins) and onboarding sessions", () => {
        expect(isOwnerLike(scope("viewer"))).toBe(false);
        expect(isOwnerLike(scope("onboarding"))).toBe(false);
    });

    it("resolveScope keeps non-viewer roles unrestricted", () => {
        expect(resolveScope({ id: "1", role: "onboarding" })).toEqual({
            role: "onboarding",
            serverIds: "all",
        });
        expect(resolveScope({ id: "apikey" })).toEqual({ role: "api", serverIds: "all" });
    });
});

describe("onboarding API allowlist", () => {
    it("permits exactly the wizard surface", () => {
        expect(isOnboardingAllowedApi("/api/auth/me", "GET")).toBe(true);
        expect(isOnboardingAllowedApi("/api/auth/logout", "POST")).toBe(true);
        expect(isOnboardingAllowedApi("/api/plex/resources", "GET")).toBe(true);
        expect(isOnboardingAllowedApi("/api/servers/test", "POST")).toBe(true);
        expect(isOnboardingAllowedApi("/api/servers", "POST")).toBe(true);
        expect(isOnboardingAllowedApi("/api/setup/status", "GET")).toBe(true);
    });

    it("denies everything else — including method and prefix tricks", () => {
        expect(isOnboardingAllowedApi("/api/servers", "GET")).toBe(false);
        expect(isOnboardingAllowedApi("/api/servers", "DELETE")).toBe(false);
        expect(isOnboardingAllowedApi("/api/servers/abc", "DELETE")).toBe(false);
        expect(isOnboardingAllowedApi("/api/servers/abc/token", "GET")).toBe(false);
        expect(isOnboardingAllowedApi("/api/servers/test", "GET")).toBe(false);
        expect(isOnboardingAllowedApi("/api/dashboard", "GET")).toBe(false);
        expect(isOnboardingAllowedApi("/api/history", "GET")).toBe(false);
        expect(isOnboardingAllowedApi("/api/settings/access", "POST")).toBe(false);
        expect(isOnboardingAllowedApi("/api/settings/invites", "POST")).toBe(false);
        expect(isOnboardingAllowedApi("/api/settings/export", "GET")).toBe(false);
    });
});
