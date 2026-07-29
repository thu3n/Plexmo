import { createJob, updateJob } from "../jobs";
import { Logger } from "../logger";

export type TrackedSync = { jobId: string; done: Promise<void> };

/** Called by the sync body as work lands, so the job row shows real progress. */
export type SyncProgress = (done: number, total: number, message: string) => void;

/**
 * Ceiling for a whole tracked sync. A full inventory pass over several servers
 * takes ~2 minutes, so 30 minutes only ever fires on a genuinely wedged run.
 * Without it a promise that never settles pins the lock for the process's
 * lifetime and every later sync gets a 409 with no way back short of a restart.
 */
const LIBRARY_SYNC_TIMEOUT_MS = 30 * 60 * 1000;

// Serialized per process: the 6h interval, server-add kicks and the manual
// "Sync now" button must never stack full inventory syncs on top of each other.
// Kept on globalThis so the instrumentation hook and the API route share one
// flag even when Next bundles them into separate module graphs.
type SyncGlobal = typeof globalThis & { __plexmo_library_sync_running?: boolean };
const syncGlobal = globalThis as SyncGlobal;

/** Whether a tracked library sync is currently in flight (this process). */
export const isLibrarySyncRunning = (): boolean => syncGlobal.__plexmo_library_sync_running === true;

/**
 * Start a library sync with a jobs-table record so it is visible under
 * Settings → Jobs. Returns immediately with the job id (the sync itself runs
 * in the background; await `done` in tests). Returns null when a sync is
 * already running.
 */
export const startTrackedLibrarySync = (
  label: string,
  syncFn: (report: SyncProgress) => Promise<unknown>,
): TrackedSync | null => {
  if (isLibrarySyncRunning()) return null;
  syncGlobal.__plexmo_library_sync_running = true;

  // SQLite boundary: in recovery mode every write throws. Without this the lock
  // would stay held for the process's lifetime and no sync could ever start.
  let job: ReturnType<typeof createJob>;
  try {
    job = createJob("library_sync");
    updateJob(job.id, { status: "running", message: `Syncing ${label}` });
  } catch (e) {
    syncGlobal.__plexmo_library_sync_running = false;
    Logger.error(`[LibrarySync] Could not record the sync job (${label}):`, e);
    return null;
  }

  // Doubles as a heartbeat: updatedAt moving is what distinguishes a live run
  // from one whose process died.
  const report: SyncProgress = (done, total, message) => {
    updateJob(job.id, {
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      itemsProcessed: done,
      totalItems: total,
      message,
    });
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Library sync exceeded ${LIBRARY_SYNC_TIMEOUT_MS / 60000} minutes`)),
      LIBRARY_SYNC_TIMEOUT_MS,
    );
  });

  const done = Promise.race([syncFn(report), timeout])
    .then(() => {
      updateJob(job.id, { status: "completed", progress: 100, message: `Synced ${label}` });
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      updateJob(job.id, { status: "failed", message });
      Logger.error(`[LibrarySync] Tracked sync failed (${label}):`, message);
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
      syncGlobal.__plexmo_library_sync_running = false;
    });

  return { jobId: job.id, done };
};
