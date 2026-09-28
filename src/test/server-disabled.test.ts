// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import {
    deleteServer,
    getServerCount,
    getServerForDashboard,
    listInternalServers,
    listServers,
    setServerDisabled,
    updateServer,
} from "@/lib/servers";

const insertServer = (id: string, createdAt: string) =>
    db
        .prepare(
            `INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt)
             VALUES (?, ?, 'http://x:32400', 'tok', ?, ?)`
        )
        .run(id, id, createdAt, createdAt);

describe("server disabled (pause monitoring) flag", () => {
    beforeEach(() => {
        db.prepare("DELETE FROM servers").run();
        insertServer("srv-a", "2026-01-01T00:00:00Z");
        insertServer("srv-b", "2026-01-02T00:00:00Z");
    });

    it("excludes a paused server from the monitoring set only", async () => {
        const paused = setServerDisabled("srv-a", true);
        expect(paused?.disabled).toBe(true);

        expect((await listInternalServers()).map((s) => s.id)).toEqual(["srv-b"]);
        // Still configured: listed in Settings and counted for setup state.
        expect((await listServers()).map((s) => [s.id, s.disabled])).toEqual([
            ["srv-a", true],
            ["srv-b", false],
        ]);
        expect(getServerCount()).toBe(2);
    });

    it("does not prime a paused server through the dashboard", async () => {
        setServerDisabled("srv-a", true);
        expect((await getServerForDashboard("srv-a"))?.id).toBe("srv-b");
    });

    it("resumes monitoring", async () => {
        setServerDisabled("srv-a", true);
        const resumed = setServerDisabled("srv-a", false);
        expect(resumed?.disabled).toBe(false);
        expect((await listInternalServers()).map((s) => s.id)).toEqual(["srv-a", "srv-b"]);
    });

    it("keeps the original pause time when paused twice", () => {
        setServerDisabled("srv-a", true);
        const first = (db.prepare("SELECT disabledAt FROM servers WHERE id = 'srv-a'").get() as { disabledAt: string }).disabledAt;
        setServerDisabled("srv-a", true);
        const second = (db.prepare("SELECT disabledAt FROM servers WHERE id = 'srv-a'").get() as { disabledAt: string }).disabledAt;
        expect(second).toBe(first);
    });

    it("is independent of archiving: a removed server cannot be paused", async () => {
        await deleteServer("srv-a");
        expect(setServerDisabled("srv-a", true)).toBeNull();
        expect(setServerDisabled("missing", true)).toBeNull();
    });

    it("survives unrelated edits", async () => {
        setServerDisabled("srv-a", true);
        const updated = await updateServer("srv-a", { name: "Renamed", color: null });
        expect(updated).toMatchObject({ name: "Renamed", disabled: true, color: null });
    });
});
