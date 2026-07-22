import type { PlexSession, SessionSummary } from "@/lib/plex";

export type DashboardSnapshot = {
  sessions: PlexSession[];
  summary: SessionSummary;
  updatedAt: string;
  appName?: string;
};

export type CachedServerSnapshot = DashboardSnapshot & {
  cachedAt: number;
};

// Marker for unreachable servers so we don't re-attempt live fetches every request.
// Cron will overwrite with a real snapshot if/when the server recovers.
type FailureRecord = {
  failedAt: number;
  message: string;
};

const globalAny = globalThis as unknown as {
  __plexmo_dashboard_cache?: Map<string, CachedServerSnapshot>;
  __plexmo_dashboard_failures?: Map<string, FailureRecord>;
};
const cache: Map<string, CachedServerSnapshot> =
  globalAny.__plexmo_dashboard_cache ?? new Map();
globalAny.__plexmo_dashboard_cache = cache;

const failures: Map<string, FailureRecord> =
  globalAny.__plexmo_dashboard_failures ?? new Map();
globalAny.__plexmo_dashboard_failures = failures;

export function setServerSnapshot(serverId: string, snapshot: DashboardSnapshot): void {
  cache.set(serverId, { ...snapshot, cachedAt: Date.now() });
  failures.delete(serverId);
}

export function getServerSnapshot(serverId: string): CachedServerSnapshot | undefined {
  return cache.get(serverId);
}

export function markServerFailure(serverId: string, message: string): void {
  failures.set(serverId, { failedAt: Date.now(), message });
}

export function getServerFailure(serverId: string): FailureRecord | undefined {
  return failures.get(serverId);
}

export function deleteServerSnapshot(serverId: string): void {
  cache.delete(serverId);
  failures.delete(serverId);
}
