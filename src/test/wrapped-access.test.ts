import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { MIN_WRAPPED_YEAR, resolveWrappedTarget } from "@/lib/stats/wrapped-access";
import type { AccessScope } from "@/lib/authz";

const NOW = new Date(2026, 8, 30);
const caller = (id: string, role: AccessScope["role"], serverIds: AccessScope["serverIds"] = "all") => ({
    id,
    scope: { role, serverIds },
});

describe("resolveWrappedTarget", () => {
    it("defaults to the caller and the current year", () => {
        expect(resolveWrappedTarget(caller("v1", "viewer"), null, null, NOW)).toEqual({
            ok: true,
            userId: "v1",
            year: 2026,
            canPickUser: false,
        });
    });

    it("lets a viewer name themselves but never someone else", () => {
        expect(resolveWrappedTarget(caller("v1", "viewer"), "v1", "2025", NOW)).toMatchObject({ ok: true, userId: "v1", year: 2025 });
        expect(resolveWrappedTarget(caller("v1", "viewer", ["s1"]), "owner", null, NOW)).toMatchObject({ ok: false, status: 403 });
    });

    it("lets owners pick anyone", () => {
        expect(resolveWrappedTarget(caller("o1", "owner"), "v1", null, NOW)).toMatchObject({ ok: true, userId: "v1", canPickUser: true });
    });

    it("requires an explicit user for API keys", () => {
        expect(resolveWrappedTarget(caller("apikey", "api"), null, null, NOW)).toMatchObject({ ok: false, status: 400 });
        expect(resolveWrappedTarget(caller("apikey", "api"), "v1", null, NOW)).toMatchObject({ ok: true, userId: "v1" });
    });

    it("rejects malformed or out-of-range years and oversized user ids", () => {
        const owner = caller("o1", "owner");
        for (const year of ["20x6", "2027", String(MIN_WRAPPED_YEAR - 1), "99999", "-2025"]) {
            expect(resolveWrappedTarget(owner, null, year, NOW)).toMatchObject({ ok: false, status: 400 });
        }
        expect(resolveWrappedTarget(owner, "x".repeat(200), null, NOW)).toMatchObject({ ok: false, status: 400 });
    });
});
