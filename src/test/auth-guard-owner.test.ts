import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { isOwnerLike, resolveScope, type AccessScope } from "@/lib/authz";
import { isWizardAllowedApi } from "@/lib/wizard-allowlist";

const scope = (role: AccessScope["role"]): { scope: AccessScope } => ({
    scope: { role, serverIds: "all" },
});

describe("isOwnerLike (requireOwner policy)", () => {
    it("allows owner and setup scopes", () => {
        expect(isOwnerLike(scope("owner"))).toBe(true);
        expect(isOwnerLike(scope("setup"))).toBe(true);
    });

    it("denies viewers (incl. Plex-reported admins), onboarding and API keys", () => {
        expect(isOwnerLike(scope("viewer"))).toBe(false);
        expect(isOwnerLike(scope("onboarding"))).toBe(false);
        // API keys are read-only; see src/test/api-key-privilege.test.ts.
        expect(isOwnerLike(scope("api"))).toBe(false);
    });

    it("resolveScope keeps non-viewer roles unrestricted", () => {
        expect(resolveScope({ id: "1", role: "onboarding" })).toEqual({
            role: "onboarding",
            serverIds: "all",
        });
        expect(resolveScope({ id: "apikey" })).toEqual({ role: "api", serverIds: "all" });
    });
});

describe("wizard API allowlist", () => {
    it("permits exactly the wizard surface", () => {
        expect(isWizardAllowedApi("/api/auth/me", "GET")).toBe(true);
        expect(isWizardAllowedApi("/api/auth/logout", "POST")).toBe(true);
        expect(isWizardAllowedApi("/api/plex/resources", "GET")).toBe(true);
        expect(isWizardAllowedApi("/api/servers/test", "POST")).toBe(true);
        expect(isWizardAllowedApi("/api/servers", "POST")).toBe(true);
        expect(isWizardAllowedApi("/api/setup/status", "GET")).toBe(true);
    });

    it("denies everything else — including method and prefix tricks", () => {
        expect(isWizardAllowedApi("/api/servers", "GET")).toBe(false);
        expect(isWizardAllowedApi("/api/servers", "DELETE")).toBe(false);
        expect(isWizardAllowedApi("/api/servers/abc", "DELETE")).toBe(false);
        expect(isWizardAllowedApi("/api/servers/abc/token", "GET")).toBe(false);
        expect(isWizardAllowedApi("/api/servers/test", "GET")).toBe(false);
        expect(isWizardAllowedApi("/api/dashboard", "GET")).toBe(false);
        expect(isWizardAllowedApi("/api/history", "GET")).toBe(false);
        expect(isWizardAllowedApi("/api/settings/access", "POST")).toBe(false);
        expect(isWizardAllowedApi("/api/settings/invites", "POST")).toBe(false);
        expect(isWizardAllowedApi("/api/settings/export", "GET")).toBe(false);
    });

    it("denies the settings writers a setup-mode instance would otherwise expose", () => {
        expect(isWizardAllowedApi("/api/settings", "POST")).toBe(false);
        expect(isWizardAllowedApi("/api/settings/apikey", "POST")).toBe(false);
        expect(isWizardAllowedApi("/api/cron", "GET")).toBe(false);
        expect(isWizardAllowedApi("/api/session/terminate", "POST")).toBe(false);
    });
});
