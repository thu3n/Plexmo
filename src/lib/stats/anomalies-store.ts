import { db } from "../db";
import {
    ANOMALY_KINDS,
    ANOMALY_SEVERITIES,
    DAY_MS,
    type AnomalyDetails,
    type AnomalyKind,
    type AnomalySeverity,
    type DetectedAnomaly,
} from "./anomalies-detect";

/**
 * Persistence for detected anomalies (table stat_anomalies, migration v19).
 *
 * De-duplication: a condition that is still present on the next scan is the
 * SAME incident — its row's lastSeenAt/observed values are refreshed instead
 * of inserting a new one, so the panel lists it once and Discord announces it
 * once. After REOPEN_GAP_MS without a sighting it counts as resolved, and a
 * recurrence opens a new incident.
 */

/** Two daily scans plus slack: one missed scan (restart at midnight) does not split an incident. */
export const REOPEN_GAP_MS = 2 * DAY_MS + DAY_MS / 2;
/** Anomalies older than this are pruned by the scan itself. */
export const ANOMALY_RETENTION_MS = 90 * DAY_MS;

export type StoredAnomaly = {
    id: number;
    kind: AnomalyKind;
    serverId: string;
    serverName: string | null;
    subject: string;
    severity: AnomalySeverity;
    observed: number;
    baseline: number | null;
    details: AnomalyDetails;
    firstDetectedAt: number;
    lastSeenAt: number;
    notifiedAt: number | null;
};

type AnomalyRow = Omit<StoredAnomaly, "details" | "kind" | "severity"> & {
    kind: string;
    severity: string;
    details: string | null;
};

const KNOWN_KINDS: ReadonlySet<string> = new Set(ANOMALY_KINDS);
const KNOWN_SEVERITIES: ReadonlySet<string> = new Set(ANOMALY_SEVERITIES);

const parseDetails = (json: string | null): AnomalyDetails => {
    if (!json) return {};
    try {
        const parsed: unknown = JSON.parse(json);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as AnomalyDetails) : {};
    } catch {
        return {};
    }
};

const toStored = (row: AnomalyRow): StoredAnomaly | null => {
    if (!KNOWN_KINDS.has(row.kind) || !KNOWN_SEVERITIES.has(row.severity)) return null;
    return {
        ...row,
        kind: row.kind as AnomalyKind,
        severity: row.severity as AnomalySeverity,
        details: parseDetails(row.details),
    };
};

const SELECT_WITH_SERVER = `
    SELECT a.id, a.kind, a.serverId, s.name AS serverName, a.subject, a.severity, a.observed,
           a.baseline, a.details, a.firstDetectedAt, a.lastSeenAt, a.notifiedAt
    FROM stat_anomalies a
    LEFT JOIN servers s ON s.id = a.serverId
`;

/**
 * Upsert detected anomalies as incidents. Returns only the NEWLY opened ones
 * — the ones worth announcing.
 */
export const recordAnomalies = (detected: DetectedAnomaly[], now: number): StoredAnomaly[] => {
    const findOpen = db.prepare(`
        SELECT id FROM stat_anomalies
        WHERE kind = ? AND serverId = ? AND subject = ? AND lastSeenAt >= ?
        ORDER BY lastSeenAt DESC LIMIT 1
    `);
    const refresh = db.prepare(`
        UPDATE stat_anomalies
        SET lastSeenAt = ?, observed = ?, baseline = ?, severity = ?, details = ?
        WHERE id = ?
    `);
    const insert = db.prepare(`
        INSERT INTO stat_anomalies
          (kind, serverId, subject, severity, observed, baseline, details, firstDetectedAt, lastSeenAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const openedIds = db.transaction(() => {
        const ids: number[] = [];
        for (const a of detected) {
            const details = JSON.stringify(a.details);
            const open = findOpen.get(a.kind, a.serverId, a.subject, now - REOPEN_GAP_MS) as { id: number } | undefined;
            if (open) {
                refresh.run(now, a.observed, a.baseline, a.severity, details, open.id);
            } else {
                const result = insert.run(a.kind, a.serverId, a.subject, a.severity, a.observed, a.baseline, details, now, now);
                ids.push(Number(result.lastInsertRowid));
            }
        }
        return ids;
    })();

    if (openedIds.length === 0) return [];
    const rows = db.prepare(`${SELECT_WITH_SERVER} WHERE a.id IN (${openedIds.map(() => "?").join(",")}) ORDER BY a.id`)
        .all(...openedIds) as AnomalyRow[];
    return rows.map(toStored).filter((a): a is StoredAnomaly => a !== null);
};

export const markAnomalyNotified = (id: number, now: number): void => {
    db.prepare("UPDATE stat_anomalies SET notifiedAt = ? WHERE id = ?").run(now, id);
};

export const pruneAnomalies = (now: number): number =>
    db.prepare("DELETE FROM stat_anomalies WHERE lastSeenAt < ?").run(now - ANOMALY_RETENTION_MS).changes;

export type ListAnomaliesParams = {
    /** Only incidents seen at or after this epoch ms. */
    since: number;
    serverId?: string;
    allowedServerIds?: string[];
    limit: number;
};

export const listAnomalies = ({ since, serverId, allowedServerIds, limit }: ListAnomaliesParams): StoredAnomaly[] => {
    const conditions = ["a.lastSeenAt >= ?"];
    const args: (string | number)[] = [since];
    if (allowedServerIds && allowedServerIds.length > 0) {
        conditions.push(`a.serverId IN (${allowedServerIds.map(() => "?").join(",")})`);
        args.push(...allowedServerIds);
    }
    if (serverId) {
        conditions.push("a.serverId = ?");
        args.push(serverId);
    }
    const rows = db.prepare(`${SELECT_WITH_SERVER} WHERE ${conditions.join(" AND ")} ORDER BY a.lastSeenAt DESC, a.id DESC LIMIT ?`)
        .all(...args, limit) as AnomalyRow[];
    return rows.map(toStored).filter((a): a is StoredAnomaly => a !== null);
};
