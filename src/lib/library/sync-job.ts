import { createJob, updateJob } from "../jobs";
import { Logger } from "../logger";

export type TrackedSync = { jobId: string; done: Promise<void> };

// Serialized per process: the 6h interval, server-add kicks and the manual
// "Sync now" button must never stack full inventory syncs on top of each other.
let running = false;

/** Whether a tracked library sync is currently in flight (this process). */
export const isLibrarySyncRunning = (): boolean => running;

/**
 * Start a library sync with a jobs-table record so it is visible under
 * Settings → Jobs. Returns immediately with the job id (the sync itself runs
 * in the background; await `done` in tests). Returns null when a sync is
 * already running.
 */
export const startTrackedLibrarySync = (
  label: string,
  syncFn: () => Promise<unknown>,
): TrackedSync | null => {
  if (running) return null;
  running = true;

  const job = createJob("library_sync");
  updateJob(job.id, { status: "running", message: `Syncing ${label}` });

  const done = syncFn()
    .then(() => {
      updateJob(job.id, { status: "completed", progress: 100, message: `Synced ${label}` });
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      updateJob(job.id, { status: "failed", message });
      Logger.error(`[LibrarySync] Tracked sync failed (${label}):`, message);
    })
    .finally(() => {
      running = false;
    });

  return { jobId: job.id, done };
};
