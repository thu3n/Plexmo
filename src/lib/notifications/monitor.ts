import type { PlexSession } from "@/lib/plex/plex-types";
import { SessionEventTracker } from "./session-events";
import { ServerHealthTracker } from "./server-health";
import { sendServerHealthNotification, sendSessionEventNotification } from "@/lib/discord";

/**
 * Cron-facing glue: feeds each poll outcome into the edge-triggered trackers
 * and fires whatever they report. Trackers live on globalThis so dev HMR and
 * the instrumentation/API module graphs share one state, like dashboard-cache.
 */

const globalAny = globalThis as unknown as {
    __plexmo_session_events?: SessionEventTracker;
    __plexmo_server_health?: ServerHealthTracker;
};
const sessionTracker = (globalAny.__plexmo_session_events ??= new SessionEventTracker());
const healthTracker = (globalAny.__plexmo_server_health ??= new ServerHealthTracker());

interface MonitoredServer {
    id: string;
    name: string;
}

export const onServerPollSuccess = (
    server: MonitoredServer,
    sessions: PlexSession[],
    newSessions: PlexSession[],
    now: number = Date.now()
): void => {
    const health = healthTracker.recordSuccess(server.id, now);
    if (health) sendServerHealthNotification(health.type, server.name, health.outageMs);

    const newIds = new Set(newSessions.map((s) => s.id));
    for (const { type, session } of sessionTracker.observe(server.id, sessions, newIds, now)) {
        sendSessionEventNotification(type, session);
    }
};

const MAX_REASON_LENGTH = 200;
const TOKEN_PATTERN = /(X-Plex-Token=)[^&\s"']+/gi;

/** Error text leaves the instance via Discord, so strip anything token-like first. */
export const sanitizeFailureReason = (reason: string): string =>
    reason.replace(TOKEN_PATTERN, "$1[redacted]").slice(0, MAX_REASON_LENGTH);

export const onServerPollFailure = (server: MonitoredServer, reason: string, now: number = Date.now()): void => {
    const health = healthTracker.recordFailure(server.id, now);
    if (health) sendServerHealthNotification(health.type, server.name, health.outageMs, sanitizeFailureReason(reason));
};
