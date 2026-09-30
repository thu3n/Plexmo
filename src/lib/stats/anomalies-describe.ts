import { BASELINE_DAYS, type AnomalyDetails, type AnomalyKind, type AnomalySeverity } from "./anomalies-detect";

/**
 * Human wording for an anomaly — shared by the stats panel (via the API) and
 * the Discord notification so both say the same thing. Pure; no DB access.
 */

export type AnomalyDescription = {
    headline: string;
    detail: string;
    /** What to check first. */
    hint: string;
};

/** One row of GET /api/stats/anomalies — wording resolved server-side. */
export type AnomalyListItem = AnomalyDescription & {
    id: number;
    kind: AnomalyKind;
    severity: AnomalySeverity;
    serverId: string;
    serverName: string | null;
    firstDetectedAt: number;
    lastSeenAt: number;
};

type DescribeInput = {
    kind: AnomalyKind;
    subject: string;
    observed: number;
    baseline: number | null;
    details: AnomalyDetails;
};

const PERCENT = 100;
const MAX_LISTED_USERS = 3;

const pct = (share: number | null): string => `${Math.round((share ?? 0) * PERCENT)}%`;
const perDay = (value: number | null): string => (value ?? 0).toFixed(1);
const num = (details: AnomalyDetails, key: string): number => {
    const value = details[key];
    return typeof value === "number" ? value : 0;
};
const users = (details: AnomalyDetails): string => {
    const list = Array.isArray(details.users) ? details.users : [];
    if (list.length === 0) return "";
    const shown = list.slice(0, MAX_LISTED_USERS).join(", ");
    return list.length > MAX_LISTED_USERS ? ` (${shown} +${list.length - MAX_LISTED_USERS})` : ` (${shown})`;
};

const HINTS: Record<AnomalyKind, string> = {
    transcode_spike:
        "Open Transcoding details: look for a new device, a remote user on limited bandwidth, or files in a codec the clients cannot play directly.",
    server_silent:
        "Check the server is online and monitored in Settings → Servers, that its token still works, and that nothing is blocking playback (storage mounts, Plex updates).",
    plays_drop:
        "Look for playback errors, an unmounted library or storage path, or users who lost access to the server.",
    plays_spike:
        "Usually a binge or a new user. Check Top users, and whether one account is being shared across locations.",
    client_transcodes:
        "Check the client's streaming quality settings (remote and local) and its codec support; a different Plex app on that device may direct play.",
};

export const describeAnomaly = (a: DescribeInput): AnomalyDescription => {
    const hint = HINTS[a.kind];
    switch (a.kind) {
        case "transcode_spike":
            return {
                headline: "Transcode share spike",
                detail: `${pct(a.observed)} of streams transcoded in the last 24h (${num(a.details, "transcodes")} of ${num(a.details, "streams")}), vs ${pct(a.baseline)} over the previous ${BASELINE_DAYS} days.`,
                hint,
            };
        case "server_silent":
            return {
                headline: "No plays for 48 hours",
                detail: `Nothing has played in the last 48h. It normally has plays on ${Math.round(a.baseline ?? 0)} of ${BASELINE_DAYS} days.`,
                hint,
            };
        case "plays_drop":
            return {
                headline: "Plays dropped",
                detail: `${a.observed} plays in the last 24h, vs about ${perDay(a.baseline)} a day over the previous ${BASELINE_DAYS} days.`,
                hint,
            };
        case "plays_spike":
            return {
                headline: "Unusually many plays",
                detail: `${a.observed} plays in the last 24h, vs about ${perDay(a.baseline)} a day over the previous ${BASELINE_DAYS} days.`,
                hint,
            };
        case "client_transcodes":
            return {
                headline: "New client transcoding",
                detail: `${a.subject} first appeared in the last 24h and transcoded ${num(a.details, "transcodes")} of ${num(a.details, "plays")} streams${users(a.details)}.`,
                hint,
            };
    }
};
