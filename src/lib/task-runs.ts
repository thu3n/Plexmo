/**
 * In-memory "last ran at" markers for background tasks that leave no row of
 * their own (the 60s cron tick). Kept on globalThis because the
 * instrumentation hook and API routes can be bundled into separate module
 * graphs; a per-module variable would never be seen by the jobs API.
 */

export type TrackedTaskId = "session_poll";

type TaskRunGlobal = typeof globalThis & { __plexmo_task_runs?: Partial<Record<TrackedTaskId, number>> };
const store = globalThis as TaskRunGlobal;

export const markTaskRun = (id: TrackedTaskId, at: number = Date.now()): void => {
    store.__plexmo_task_runs = { ...store.__plexmo_task_runs, [id]: at };
};

export const getTaskLastRun = (id: TrackedTaskId): number | null => store.__plexmo_task_runs?.[id] ?? null;
