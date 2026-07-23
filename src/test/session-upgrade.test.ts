// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { canUpgradeSessionToOwner } from "@/lib/authz";

describe("canUpgradeSessionToOwner (first-server session upgrade)", () => {
    it("upgrades a fresh-install setup session that connected its own server", () => {
        expect(canUpgradeSessionToOwner("setup", "plex-123", "plex-123")).toBe(true);
    });

    it("upgrades an invite-minted onboarding session that connected its own server", () => {
        expect(canUpgradeSessionToOwner("onboarding", "plex-123", "plex-123")).toBe(true);
    });

    it("never upgrades on a foreign token (anti-escalation backstop)", () => {
        expect(canUpgradeSessionToOwner("setup", "plex-999", "plex-123")).toBe(false);
        expect(canUpgradeSessionToOwner("onboarding", "plex-999", "plex-123")).toBe(false);
    });

    it("never upgrades when the owner could not be resolved", () => {
        expect(canUpgradeSessionToOwner("setup", null, "plex-123")).toBe(false);
    });

    it("never upgrades roles that are not mid-onboarding", () => {
        expect(canUpgradeSessionToOwner("owner", "plex-123", "plex-123")).toBe(false);
        expect(canUpgradeSessionToOwner("viewer", "plex-123", "plex-123")).toBe(false);
        expect(canUpgradeSessionToOwner("api", "plex-123", "plex-123")).toBe(false);
    });
});
