import { db } from "../db";
import { buildQualityFilter, WAN_LOCATION, type QualityParams } from "./server-quality-filter";

/**
 * Plex Relay share of remote (WAN) plays. Relay only kicks in when a client
 * can't reach the server directly, and Plex caps relayed bitrate hard — so a
 * meaningful relay share almost always means Remote Access / port forwarding
 * is broken for that server. Rows without a recorded relay flag are excluded
 * from the share instead of counted as direct.
 */

/** Relay share (0..1) of remote plays at which the port-forward warning fires. */
export const RELAY_WARNING_SHARE = 0.1;
/** Too few relayed plays is noise (one hotel Wi-Fi session), not a config problem. */
export const MIN_RELAY_WARNING_PLAYS = 3;
const DEFAULT_RELAY_LIMIT = 10;

export type RelayedUser = { userId: string; user: string; wanPlays: number; relayed: number; share: number };
export type RelayedServer = { serverId: string; name: string; wanPlays: number; relayed: number; share: number };

export type RelayShareResult = {
    wanPlays: number;
    /** WAN plays whose relay flag was recorded — the share's denominator. */
    knownPlays: number;
    relayed: number;
    /** Relayed / known WAN plays, 0..100. */
    share: number;
    warning: string | null;
    users: RelayedUser[];
    servers: RelayedServer[];
};

type CountRow = { wanPlays: number; knownPlays: number; relayed: number };

const percent = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

const RELAY_COUNTS = `
  COUNT(*) AS wanPlays,
  COALESCE(SUM(CASE WHEN h.relayed IS NOT NULL THEN 1 ELSE 0 END), 0) AS knownPlays,
  COALESCE(SUM(CASE WHEN h.relayed = 1 THEN 1 ELSE 0 END), 0) AS relayed
`;

export const relayWarning = (
    relayed: number,
    knownPlays: number,
    worstServer?: Pick<RelayedServer, "name" | "share">,
): string | null => {
    if (relayed < MIN_RELAY_WARNING_PLAYS || knownPlays === 0 || relayed / knownPlays < RELAY_WARNING_SHARE) {
        return null;
    }
    const worst = worstServer ? ` (worst: ${worstServer.name} at ${worstServer.share}%)` : "";
    return `${percent(relayed, knownPlays)}% of remote plays go through Plex Relay${worst}, which caps quality → check Remote Access and port forwarding.`;
};

export const getRelayShare = (params: QualityParams & { limit?: number }): RelayShareResult => {
    const { where, args } = buildQualityFilter(params);
    const limit = params.limit ?? DEFAULT_RELAY_LIMIT;
    const wanWhere = `${where} AND h.location = '${WAN_LOCATION}'`;

    const totals = db.prepare(`
        SELECT ${RELAY_COUNTS} FROM activity_history h WHERE ${wanWhere}
    `).get(...args) as CountRow;

    const users = (db.prepare(`
        SELECT h.userId AS userId, MAX(h.user) AS user, ${RELAY_COUNTS}
        FROM activity_history h
        WHERE ${wanWhere}
        GROUP BY h.userId
        HAVING relayed > 0
        ORDER BY relayed DESC, wanPlays DESC
        LIMIT ?
    `).all(...args, limit) as (CountRow & { userId: string; user: string })[]).map((row) => ({
        userId: row.userId,
        user: row.user,
        wanPlays: row.wanPlays,
        relayed: row.relayed,
        share: percent(row.relayed, row.knownPlays),
    }));

    const servers = (db.prepare(`
        SELECT h.serverId AS serverId, COALESCE(s.name, h.serverId) AS name, ${RELAY_COUNTS}
        FROM activity_history h
        LEFT JOIN servers s ON s.id = h.serverId
        WHERE ${wanWhere}
        GROUP BY h.serverId
        HAVING relayed > 0
        ORDER BY relayed DESC
    `).all(...args) as (CountRow & { serverId: string; name: string })[]).map((row) => ({
        serverId: row.serverId,
        name: row.name,
        wanPlays: row.wanPlays,
        relayed: row.relayed,
        share: percent(row.relayed, row.knownPlays),
    }));

    // Name the server only when several are in play — with one it's implied.
    const worst = servers.length > 1 ? [...servers].sort((a, b) => b.share - a.share)[0] : undefined;

    return {
        wanPlays: totals.wanPlays,
        knownPlays: totals.knownPlays,
        relayed: totals.relayed,
        share: percent(totals.relayed, totals.knownPlays),
        warning: relayWarning(totals.relayed, totals.knownPlays, worst),
        users,
        servers,
    };
};
