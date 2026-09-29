import type { PlexSession } from "@/lib/plex";

export type DashboardSummary = {
    active: number;
    paused: number;
    directPlay: number;
    directStream: number;
    transcoding: number;
    /** kbps, as Plex reports it. */
    bandwidth: number;
    lanBandwidth: number;
    wanBandwidth: number;
};

const KBPS_PER_MBPS = 1000;

export const EMPTY_SUMMARY: DashboardSummary = {
    active: 0,
    paused: 0,
    directPlay: 0,
    directStream: 0,
    transcoding: 0,
    bandwidth: 0,
    lanBandwidth: 0,
    wanBandwidth: 0,
};

/**
 * Client-side twin of the server summary, computed from one session list so
 * the "all servers" and filtered views can never disagree. Paused counts on
 * top of the decision; the LAN/WAN split is what actually loads the uplink.
 */
export function summarizeSessions(sessions: PlexSession[]): DashboardSummary {
    return sessions.reduce<DashboardSummary>((acc, session) => {
        const decision = session.decision?.toLowerCase();
        const bandwidth = session.bandwidth || 0;

        acc.active++;
        if (session.state?.toLowerCase() === "paused") acc.paused++;
        if (decision === "transcode") acc.transcoding++;
        else if (decision === "direct stream") acc.directStream++;
        else acc.directPlay++;

        acc.bandwidth += bandwidth;
        // Plex reports "lan", "wan" or "cellular"; anything not LAN leaves the network.
        if (session.location?.toLowerCase() === "lan") acc.lanBandwidth += bandwidth;
        else acc.wanBandwidth += bandwidth;
        return acc;
    }, { ...EMPTY_SUMMARY });
}

export const formatMbps = (kbps: number): string =>
    kbps ? `${(kbps / KBPS_PER_MBPS).toFixed(1)} Mbps` : "0 Mbps";
