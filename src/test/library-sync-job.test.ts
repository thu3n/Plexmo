// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { INTERRUPTED_JOB_MESSAGE, createJob, reclaimInterruptedJobs, updateJob } from "@/lib/jobs";
import { startTrackedLibrarySync } from "@/lib/library/sync-job";

type JobRow = {
    id: string; type: string; status: string; progress: number;
    message: string | null; itemsProcessed: number; totalItems: number;
};

const jobById = (id: string): JobRow =>
    db.prepare(
        "SELECT id, type, status, progress, message, itemsProcessed, totalItems FROM jobs WHERE id = ?"
    ).get(id) as JobRow;

/** Backdate a row so it looks like it was left behind by a dead process. */
const backdate = (id: string, minutesAgo: number) =>
    db.prepare("UPDATE jobs SET updatedAt = ? WHERE id = ?")
        .run(new Date(Date.now() - minutesAgo * 60_000).toISOString(), id);

beforeEach(() => {
    db.prepare("DELETE FROM jobs").run();
});

afterEach(() => {
    vi.useRealTimers();
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

    it("writes progress and a moving heartbeat while the sync runs", async () => {
        let report!: (done: number, total: number, message: string) => void;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));

        const started = startTrackedLibrarySync("all libraries", (r) => {
            report = r;
            return gate;
        });

        report(1, 4, "Synced 1/4 servers");
        const midway = jobById(started!.jobId);
        expect(midway.status).toBe("running");
        expect(midway.progress).toBe(25);
        expect(midway.itemsProcessed).toBe(1);
        expect(midway.totalItems).toBe(4);
        expect(midway.message).toBe("Synced 1/4 servers");

        release();
        await started!.done;
        expect(jobById(started!.jobId).status).toBe("completed");
    });

    it("times out a wedged sync, fails the job and releases the lock", async () => {
        vi.useFakeTimers();

        // A sync whose promise never settles used to pin the lock for the
        // process's whole lifetime.
        const started = startTrackedLibrarySync("all libraries", () => new Promise<void>(() => {}));
        expect(started).not.toBeNull();

        await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
        await started!.done;

        const job = jobById(started!.jobId);
        expect(job.status).toBe("failed");
        expect(job.message).toContain("exceeded");

        // Lock released: a new sync can start without a restart.
        const next = startTrackedLibrarySync("all libraries", async () => {});
        expect(next).not.toBeNull();
        await next!.done;
    });
});

describe("reclaimInterruptedJobs", () => {
    it("fails jobs a dead process left running or pending", () => {
        const running = createJob("library_sync");
        updateJob(running.id, { status: "running", message: "Syncing all libraries" });
        backdate(running.id, 90);

        const pending = createJob("tautulli_import");
        backdate(pending.id, 90);

        expect(reclaimInterruptedJobs()).toBe(2);
        expect(jobById(running.id).status).toBe("failed");
        expect(jobById(running.id).message).toBe(INTERRUPTED_JOB_MESSAGE);
        expect(jobById(pending.id).status).toBe("failed");
    });

    it("leaves a freshly started job and already-terminal rows alone", () => {
        const fresh = createJob("library_sync");
        updateJob(fresh.id, { status: "running" });

        const completed = createJob("library_sync");
        updateJob(completed.id, { status: "completed", progress: 100 });
        backdate(completed.id, 90);

        expect(reclaimInterruptedJobs()).toBe(0);
        expect(jobById(fresh.id).status).toBe("running");
        expect(jobById(completed.id).status).toBe("completed");
    });
});
