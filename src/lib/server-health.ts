import type { ProbeResult } from "./server-probe";

/** Health of one configured server, as shown on its Settings card. */
export type ServerHealthState = "online" | "unauthorized" | "unreachable" | "disabled";

export type ServerHealth = {
    serverId: string;
    state: ServerHealthState;
    latencyMs: number | null;
    version: string | null;
    platform: string | null;
    message: string | null;
    /** Last successful cron poll (ISO), null if none since process start. */
    lastSeenAt: string | null;
    checkedAt: string;
};

export type ServerHealthResponse = { servers: ServerHealth[] };

const toIso = (epochMs: number | undefined): string | null =>
    epochMs === undefined ? null : new Date(epochMs).toISOString();

export const disabledHealth = (serverId: string, lastSeenMs: number | undefined, now: Date): ServerHealth => ({
    serverId,
    state: "disabled",
    latencyMs: null,
    version: null,
    platform: null,
    message: "Monitoring paused",
    lastSeenAt: toIso(lastSeenMs),
    checkedAt: now.toISOString(),
});

export const healthFromProbe = (
    serverId: string,
    probe: ProbeResult,
    lastSeenMs: number | undefined,
    now: Date
): ServerHealth => {
    const base = { serverId, lastSeenAt: toIso(lastSeenMs), checkedAt: now.toISOString() };
    if (probe.ok) {
        return {
            ...base,
            state: "online",
            latencyMs: probe.latencyMs,
            version: probe.version,
            platform: probe.platform,
            message: null,
            // A successful probe is itself a sighting, newer than any cron poll.
            lastSeenAt: now.toISOString(),
        };
    }
    return {
        ...base,
        state: probe.reason === "unauthorized" ? "unauthorized" : "unreachable",
        latencyMs: probe.latencyMs,
        version: null,
        platform: null,
        message: probe.message,
    };
};
