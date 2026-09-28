/**
 * Debounced server up/down detection. A single failed poll (Plex restart,
 * network blip, WebSocket-kicked rerun racing a slow response) must not page
 * anyone, so "down" needs BOTH a run of consecutive failures AND a minimum
 * outage duration — the cron can run several times a minute when other
 * servers' WebSockets kick it, so a count alone would trip too fast.
 */

export const SERVER_DOWN_MIN_FAILURES = 3;
export const SERVER_DOWN_MIN_DURATION_MS = 2 * 60_000;

interface HealthState {
    consecutiveFailures: number;
    firstFailureAt: number | null;
    /** Set once "down" has been announced; "up" is only announced after this. */
    downAnnouncedAt: number | null;
}

export type ServerHealthEvent =
    | { type: "server_down"; outageMs: number }
    | { type: "server_up"; outageMs: number };

export class ServerHealthTracker {
    private readonly states = new Map<string, HealthState>();

    recordFailure(serverId: string, now: number): ServerHealthEvent | null {
        const state = this.states.get(serverId) ?? {
            consecutiveFailures: 0,
            firstFailureAt: null,
            downAnnouncedAt: null,
        };
        state.consecutiveFailures += 1;
        state.firstFailureAt ??= now;
        this.states.set(serverId, state);

        if (state.downAnnouncedAt !== null) return null;
        const outageMs = now - state.firstFailureAt;
        if (state.consecutiveFailures < SERVER_DOWN_MIN_FAILURES || outageMs < SERVER_DOWN_MIN_DURATION_MS) {
            return null;
        }
        state.downAnnouncedAt = now;
        return { type: "server_down", outageMs };
    }

    recordSuccess(serverId: string, now: number): ServerHealthEvent | null {
        const state = this.states.get(serverId);
        this.states.delete(serverId);
        if (!state || state.downAnnouncedAt === null || state.firstFailureAt === null) return null;
        return { type: "server_up", outageMs: now - state.firstFailureAt };
    }

    forget(serverId: string): void {
        this.states.delete(serverId);
    }
}
