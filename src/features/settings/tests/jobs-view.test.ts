import { describe, expect, it } from "vitest";
import {
    ALL_JOB_TYPES,
    filterJobs,
    formatJobType,
    JOBS_FAST_POLL_MS,
    JOBS_SLOW_POLL_MS,
    selectJobsPollInterval,
    type JobRecord,
} from "@/features/settings/lib/jobs-view";
import { localDateKeyToMs, nextAlignedRun, nextRunAfter } from "@/lib/schedule-math";

const job = (id: string, type: string, status: JobRecord["status"]): JobRecord => ({
    id,
    type,
    status,
    progress: 0,
    message: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
});

describe("selectJobsPollInterval", () => {
    it("polls fast only while a job is pending or running", () => {
        expect(selectJobsPollInterval([job("1", "library_sync", "running")])).toBe(JOBS_FAST_POLL_MS);
        expect(selectJobsPollInterval([job("1", "library_sync", "pending")])).toBe(JOBS_FAST_POLL_MS);
        expect(selectJobsPollInterval([job("1", "library_sync", "completed"), job("2", "x", "failed")])).toBe(JOBS_SLOW_POLL_MS);
        expect(selectJobsPollInterval([])).toBe(JOBS_SLOW_POLL_MS);
        expect(selectJobsPollInterval(undefined)).toBe(JOBS_SLOW_POLL_MS);
    });
});

describe("filterJobs", () => {
    const jobs = [job("1", "library_sync", "running"), job("2", "library_sync", "failed"), job("3", "import_tautulli", "completed")];

    it("filters by status group and type", () => {
        expect(filterJobs(jobs, "all", ALL_JOB_TYPES).map((j) => j.id)).toEqual(["1", "2", "3"]);
        expect(filterJobs(jobs, "active", ALL_JOB_TYPES).map((j) => j.id)).toEqual(["1"]);
        expect(filterJobs(jobs, "failed", "library_sync").map((j) => j.id)).toEqual(["2"]);
        expect(filterJobs(jobs, "completed", "library_sync")).toEqual([]);
    });

    it("formats job types for display", () => {
        expect(formatJobType("import_tautulli_db")).toBe("Import tautulli db");
    });
});

describe("schedule math", () => {
    it("nextRunAfter never returns a time in the past", () => {
        expect(nextRunAfter(null, 1000, 5000)).toBeNull();
        expect(nextRunAfter(4500, 1000, 5000)).toBe(5500);
        expect(nextRunAfter(1000, 1000, 5000)).toBe(5000);
    });

    it("nextAlignedRun follows setInterval ticks from the anchor", () => {
        expect(nextAlignedRun(0, 100, 250)).toBe(300);
        expect(nextAlignedRun(0, 100, 300)).toBe(400);
        expect(nextAlignedRun(1000, 100, 500)).toBe(1000);
    });

    it("parses local date keys", () => {
        expect(localDateKeyToMs("2026-09-28")).toBe(new Date(2026, 8, 28).getTime());
        expect(localDateKeyToMs("garbage")).toBeNull();
        expect(localDateKeyToMs(undefined)).toBeNull();
    });
});
