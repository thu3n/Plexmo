/**
 * Pure anomaly rules over pre-aggregated per-server metrics (anomalies-query.ts
 * collects them). Every rule needs a minimum sample on BOTH sides of the
 * comparison: a small instance with three plays a day would otherwise page
 * someone every time one person watches something different.
 */

export const ANOMALY_KINDS = [
    "transcode_spike",
    "server_silent",
    "plays_drop",
    "plays_spike",
    "client_transcodes",
] as const;
export type AnomalyKind = (typeof ANOMALY_KINDS)[number];

export const ANOMALY_SEVERITIES = ["info", "warning", "critical"] as const;
export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** "Today" = the 24h before the scan, compared against the 14 days before that. */
export const CURRENT_WINDOW_MS = DAY_MS;
export const BASELINE_DAYS = 14;
/** A server is "silent" after this long without a single play. */
export const SILENT_WINDOW_MS = 48 * HOUR_MS;

/** Transcode spike: streams with a known decision needed in each window. */
export const MIN_TRANSCODE_SAMPLE = 10;
export const MIN_TRANSCODE_BASELINE_SAMPLE = 30;
/** Share must rise by >= 20 percentage points AND to >= 1.5x the baseline share. */
export const TRANSCODE_SPIKE_MIN_DELTA = 0.2;
export const TRANSCODE_SPIKE_MIN_RATIO = 1.5;
export const TRANSCODE_SPIKE_CRITICAL_DELTA = 0.4;

/** Silent server: must normally have plays on at least this many of the baseline days. */
export const SILENT_MIN_ACTIVE_DAYS = 10;

/** Plays drop/spike only apply once a server averages this many plays a day. */
export const MIN_EXPECTED_DAILY_PLAYS = 5;
export const PLAYS_DROP_RATIO = 0.3;
export const PLAYS_SPIKE_RATIO = 3;
/** A spike must also add this many plays over the expectation (3x of 5 is not news). */
export const PLAYS_SPIKE_MIN_EXTRA = 10;

/** New client: transcodes needed in its first 24h, and the share of its streams they make up. */
export const NEW_CLIENT_MIN_TRANSCODES = 3;
export const NEW_CLIENT_MIN_SHARE = 0.5;
/** Every client on a freshly added server is "new" — require an established server. */
export const NEW_CLIENT_MIN_BASELINE_PLAYS = 20;

const MAX_SUBJECT_LENGTH = 200;
const UNKNOWN_CLIENT = "Unknown";

export type ServerWindowMetrics = {
    serverId: string;
    /** Plays in the current window (last 24h). */
    currentPlays: number;
    currentKnownDecisions: number;
    currentTranscodes: number;
    /** Plays in the BASELINE_DAYS before the current window. */
    baselinePlays: number;
    baselineKnownDecisions: number;
    baselineTranscodes: number;
    /** Plays in the last SILENT_WINDOW_MS. */
    silentWindowPlays: number;
    /** Local days with >= 1 play in the BASELINE_DAYS before the silent window. */
    silentBaselineActiveDays: number;
};

/** A client (platform + player) first seen on a server during the current window. */
export type NewClientMetrics = {
    serverId: string;
    platform: string | null;
    client: string | null;
    plays: number;
    transcodes: number;
    users: string[];
};

export type AnomalyDetails = Record<string, number | string | string[]>;

export type DetectedAnomaly = {
    kind: AnomalyKind;
    serverId: string;
    /** Distinguishes same-kind incidents on one server; '' when unused. */
    subject: string;
    severity: AnomalySeverity;
    observed: number;
    baseline: number | null;
    details: AnomalyDetails;
};

const share = (part: number, total: number): number => (total > 0 ? part / total : 0);

export const detectTranscodeSpike = (m: ServerWindowMetrics): DetectedAnomaly | null => {
    if (m.currentKnownDecisions < MIN_TRANSCODE_SAMPLE) return null;
    if (m.baselineKnownDecisions < MIN_TRANSCODE_BASELINE_SAMPLE) return null;
    const current = share(m.currentTranscodes, m.currentKnownDecisions);
    const baseline = share(m.baselineTranscodes, m.baselineKnownDecisions);
    const delta = current - baseline;
    if (delta < TRANSCODE_SPIKE_MIN_DELTA || current < baseline * TRANSCODE_SPIKE_MIN_RATIO) return null;
    return {
        kind: "transcode_spike",
        serverId: m.serverId,
        subject: "",
        severity: delta >= TRANSCODE_SPIKE_CRITICAL_DELTA ? "critical" : "warning",
        observed: current,
        baseline,
        details: { transcodes: m.currentTranscodes, streams: m.currentKnownDecisions },
    };
};

export const detectSilentServer = (m: ServerWindowMetrics): DetectedAnomaly | null => {
    if (m.silentWindowPlays > 0 || m.silentBaselineActiveDays < SILENT_MIN_ACTIVE_DAYS) return null;
    return {
        kind: "server_silent",
        serverId: m.serverId,
        subject: "",
        severity: "critical",
        observed: 0,
        baseline: m.silentBaselineActiveDays,
        details: { baselineDays: BASELINE_DAYS },
    };
};

export const detectPlaysChange = (m: ServerWindowMetrics): DetectedAnomaly | null => {
    const expected = m.baselinePlays / BASELINE_DAYS;
    if (expected < MIN_EXPECTED_DAILY_PLAYS) return null;
    const base = { serverId: m.serverId, subject: "", observed: m.currentPlays, baseline: expected, details: {} };
    if (m.currentPlays <= expected * PLAYS_DROP_RATIO) {
        return { ...base, kind: "plays_drop", severity: "warning" };
    }
    if (m.currentPlays >= expected * PLAYS_SPIKE_RATIO && m.currentPlays - expected >= PLAYS_SPIKE_MIN_EXTRA) {
        return { ...base, kind: "plays_spike", severity: "info" };
    }
    return null;
};

export const clientSubject = (platform: string | null, client: string | null): string =>
    `${platform?.trim() || UNKNOWN_CLIENT} · ${client?.trim() || UNKNOWN_CLIENT}`.slice(0, MAX_SUBJECT_LENGTH);

export const detectNewClient = (c: NewClientMetrics, serverBaselinePlays: number): DetectedAnomaly | null => {
    if (serverBaselinePlays < NEW_CLIENT_MIN_BASELINE_PLAYS) return null;
    if (c.transcodes < NEW_CLIENT_MIN_TRANSCODES || share(c.transcodes, c.plays) < NEW_CLIENT_MIN_SHARE) return null;
    return {
        kind: "client_transcodes",
        serverId: c.serverId,
        subject: clientSubject(c.platform, c.client),
        severity: "warning",
        observed: c.transcodes,
        baseline: null,
        details: { plays: c.plays, transcodes: c.transcodes, users: c.users },
    };
};

/**
 * Run every rule. A silent server's plays drop is the same incident told
 * twice, so the drop is suppressed when the silence fires.
 */
export const detectAnomalies = (
    servers: ServerWindowMetrics[],
    newClients: NewClientMetrics[],
): DetectedAnomaly[] => {
    const found: DetectedAnomaly[] = [];
    const baselineByServer = new Map(servers.map((m) => [m.serverId, m.baselinePlays]));
    for (const m of servers) {
        const silent = detectSilentServer(m);
        if (silent) found.push(silent);
        const transcode = detectTranscodeSpike(m);
        if (transcode) found.push(transcode);
        const plays = detectPlaysChange(m);
        if (plays && !(silent && plays.kind === "plays_drop")) found.push(plays);
    }
    for (const c of newClients) {
        const anomaly = detectNewClient(c, baselineByServer.get(c.serverId) ?? 0);
        if (anomaly) found.push(anomaly);
    }
    return found;
};
