// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { startTrackedLibrarySync } from "@/lib/library/sync-job";

type JobRow = { id: string; type: string; status: string; progress: number; message: string | null };

const jobById = (id: string): JobRow =>
    db.prepare("SELECT id, type, status, progress, message FROM jobs WHERE id = ?").get(id) as JobRow;

beforeEach(() => {
    db.prepare("DELETE FROM jobs").run();
});

describe("startTrackedLibrarySync", () => {
    it("records a completed library_sync job on success", async () => {
        const sync = vi.fn(async () => 42);
        const started = startTrackedLibrarySync("all libraries", sync);
        expect(started).not.toBeNull();
        await started!.done;

        const job = jobById(started!.jobId);
        expect(job.type).toBe("library_sync");
        expect(job.status).toBe("completed");
        expect(job.progress).toBe(100);
        expect(job.message).toContain("all libraries");
        expect(sync).toHaveBeenCalledOnce();
    });

    it("records a failed job with the error message when the sync throws", async () => {
        const started = startTrackedLibrarySync("Server X", async () => {
            throw new Error("connect ECONNREFUSED");
        });
        await started!.done;

        const job = jobById(started!.jobId);
        expect(job.status).toBe("failed");
        expect(job.message).toBe("connect ECONNREFUSED");
    });

    it("refuses to stack overlapping syncs, then allows a new run after completion", async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const first = startTrackedLibrarySync("all libraries", () => gate);

        expect(startTrackedLibrarySync("all libraries", async () => {})).toBeNull();

        release();
        await first!.done;

        const third = startTrackedLibrarySync("all libraries", async () => {});
        expect(third).not.toBeNull();
        await third!.done;
    });
});
