import { db } from "../db";
import { buildWindowFilter, type PeopleScope, type PersonRef } from "./user-insights-shared";

/**
 * Possible shared accounts: one account streaming at the same time from two
 * different client IPs. Deliberately conservative ("possible", not proof):
 * - both streams must overlap for at least MIN_OVERLAP_MS, so a device
 *   hand-off whose first session stopped late is not an incident;
 * - a pair where both clients are on the LAN / private address space is a
 *   household (each LAN device has its own private IP), not sharing.
 * A household on the WAN shares one public IP, so it never trips this either.
 */

export const MIN_OVERLAP_MS = 2 * 60 * 1000;
const DEFAULT_LIMIT = 10;

export type SharedAccountSuspect = PersonRef & {
    /** Overlapping stream pairs from different IPs. */
    incidents: number;
    /** Distinct IPs seen across those incidents. */
    distinctIps: number;
    /** Start of the later stream in the most recent incident, epoch ms. */
    lastOccurrence: number;
};

export type SharedAccountParams = PeopleScope & { limit?: number };

type StreamRow = {
    accountId: string;
    user: string;
    thumb: string | null;
    ip: string;
    location: string | null;
    startTime: number;
    stopTime: number;
};

const PRIVATE_IPV4 = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^127\./,
    /^169\.254\./,
];

/** RFC1918 / loopback / link-local / IPv6 ULA + link-local. */
export const isPrivateIp = (ip: string): boolean => {
    const lower = ip.toLowerCase().replace(/^::ffff:/, "");
    if (PRIVATE_IPV4.some((re) => re.test(lower))) return true;
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
};

const isLocal = (row: StreamRow) => row.location === "lan" || isPrivateIp(row.ip);

type Tally = { person: PersonRef; incidents: number; ips: Set<string>; last: number };

/** Pure sweep over one account's streams (sorted by startTime). Exported for tests. */
export const countSharingIncidents = (streams: StreamRow[]) => {
    let incidents = 0;
    let last = 0;
    const ips = new Set<string>();
    for (let i = 0; i < streams.length; i++) {
        const a = streams[i];
        for (let j = i + 1; j < streams.length; j++) {
            const b = streams[j];
            // Sorted by start: once b starts after a stops, no later stream overlaps a.
            if (b.startTime >= a.stopTime) break;
            if (a.ip === b.ip) continue;
            if (isLocal(a) && isLocal(b)) continue;
            const overlap = Math.min(a.stopTime, b.stopTime) - b.startTime;
            if (overlap < MIN_OVERLAP_MS) continue;
            incidents++;
            ips.add(a.ip).add(b.ip);
            last = Math.max(last, b.startTime);
        }
    }
    return { incidents, ips, last };
};

export const getSharedAccountSuspects = (params: SharedAccountParams): SharedAccountSuspect[] => {
    const { where, args } = buildWindowFilter(params);
    const rows = db.prepare(`
        SELECT h.userId AS accountId,
               COALESCE(ui.title, h.user) AS user,
               ui.thumb AS thumb,
               h.ip, h.location, h.startTime, h.stopTime
        FROM activity_history h
        LEFT JOIN user_identities ui ON ui.accountId = h.userId
        WHERE ${where}
          AND h.userId IS NOT NULL
          AND h.ip IS NOT NULL AND h.ip != ''
          AND h.stopTime > h.startTime
        ORDER BY h.userId, h.startTime
    `).all(...args) as StreamRow[];

    const byUser = new Map<string, StreamRow[]>();
    for (const row of rows) {
        const list = byUser.get(row.accountId) ?? [];
        list.push(row);
        byUser.set(row.accountId, list);
    }

    const tallies: Tally[] = [];
    for (const streams of byUser.values()) {
        const { incidents, ips, last } = countSharingIncidents(streams);
        if (incidents === 0) continue;
        const { accountId, user, thumb } = streams[streams.length - 1];
        tallies.push({ person: { accountId, user, thumb }, incidents, ips, last });
    }

    return tallies
        .sort((a, b) => b.incidents - a.incidents || b.last - a.last)
        .slice(0, params.limit ?? DEFAULT_LIMIT)
        .map((t) => ({ ...t.person, incidents: t.incidents, distinctIps: t.ips.size, lastOccurrence: t.last }));
};
