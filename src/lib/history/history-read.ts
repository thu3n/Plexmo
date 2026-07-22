import { db } from "../db";
import { findIdentityByName } from "../identity";
import type { CountRow, ActiveSessionRow } from "../db-types";
import type { HistoryEntry, HistoryParams, HistoryResult } from "./types";

type ActiveSessionJoined = ActiveSessionRow & { serverName: string | null };

const getActiveSessionsForServer = db.prepare<{ serverId: string }, ActiveSessionJoined>(`
  SELECT a.*, s.name as serverName
  FROM active_sessions a
  LEFT JOIN servers s ON a.serverId = s.id
  WHERE a.serverId = @serverId
`);

const getAllActiveSessions = db.prepare<[], ActiveSessionJoined>(`
  SELECT a.*, s.name as serverName
  FROM active_sessions a
  LEFT JOIN servers s ON a.serverId = s.id
`);

/**
 * Resolve a user filter value (username, display title, or accountId) to the
 * canonical accountId. Post-migration every history row carries a valid
 * accountId, so a single equality match replaces the old fuzzy ORs.
 */
const resolveUserFilter = (value: string): string => {
  const identity = findIdentityByName(value);
  return identity ? identity.accountId : value;
};

export const getHistory = (params: HistoryParams = {}): HistoryResult => {
  const { page = 1, pageSize = 25, serverId, userId, search, allowedServerIds } = params;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (allowedServerIds && allowedServerIds.length > 0) {
    conditions.push(`h.serverId IN (${allowedServerIds.map(() => "?").join(",")})`);
    args.push(...allowedServerIds);
  }

  if (serverId && serverId !== "all") {
    conditions.push("h.serverId = ?");
    args.push(serverId);
  }

  let accountFilter: string | undefined;
  if (userId && userId !== "all") {
    accountFilter = resolveUserFilter(userId);
    conditions.push("h.userId = ?");
    args.push(accountFilter);
  }

  if (search) {
    // Match surfaces: frozen row text (title + subtitle), the canonical
    // episode/show title via mediaId, and every server's own library title
    // for the media or its show. Servers display the same series in
    // different languages ("Sunny Side"/"Solsidan"/a Spanish original), so a
    // search in ANY variant must find the linked plays regardless of what
    // the recording server called it at watch time.
    conditions.push(`(
      h.title LIKE ? OR h.subtitle LIKE ?
      OR EXISTS (
        SELECT 1 FROM media_items e
        LEFT JOIN media_items p ON e.showMediaId = p.id
        WHERE e.id = h.mediaId AND (e.title LIKE ? OR p.title LIKE ?)
      )
      OR EXISTS (
        SELECT 1 FROM media_items e2
        JOIN library_items li
          ON li.mediaId IN (e2.id, e2.showMediaId)
        WHERE e2.id = h.mediaId AND li.title LIKE ?
      )
    )`);
    const term = `%${search}%`;
    args.push(term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 1. Stored history page. freshThumb: the meta_json thumb froze at watch
  // time and Plex can reassign ratingKeys later (observed: a 2024 play
  // rendering unrelated art) — the library inventory's current thumb wins
  // when the canonical media link can provide one.
  const historyQuery = `
    SELECT h.*, s.name as serverName,
      (SELECT li.thumb FROM library_items li
       WHERE li.mediaId = h.mediaId AND li.serverId = h.serverId
       LIMIT 1) as freshThumb
    FROM activity_history h
    LEFT JOIN servers s ON h.serverId = s.id
    ${whereClause}
    ORDER BY h.startTime DESC
    LIMIT ? OFFSET ?
  `;

  // 2. Total count for pagination
  const countQuery = `
    SELECT COUNT(*) as count
    FROM activity_history h
    ${whereClause}
  `;

  const historyEntries = db.prepare(historyQuery).all(...args, pageSize, offset) as HistoryEntry[];
  const totalCount = (db.prepare(countQuery).get(...args) as CountRow).count;

  // 3. Active sessions, filtered by the same criteria. The UI prepends them on
  // page 1.
  const activeRows =
    serverId && serverId !== "all"
      ? getActiveSessionsForServer.all({ serverId })
      : getAllActiveSessions.all();

  const activeHistory: HistoryEntry[] = activeRows
    .map((row) => {
      const now = Date.now();
      const duration = Math.round((now - row.startTime) / 1000);

      return {
        id: `active-${row.serverId}:${row.sessionKey}`,
        serverId: row.serverId,
        userId: row.userId || undefined,
        user: row.user,
        title: row.title,
        subtitle: row.subtitle || undefined,
        ratingKey: row.ratingKey,
        startTime: row.startTime,
        stopTime: 0,
        duration: duration,
        platform: row.platform || undefined,
        device: row.device || undefined,
        ip: row.ip || undefined,
        serverName: row.serverName || "Unknown",
        meta_json: row.meta_json || undefined,
        pausedCounter: row.pausedCounter,
      };
    })
    .filter((entry) => {
      let match = true;
      if (accountFilter && entry.userId !== accountFilter) match = false;
      if (search && !entry.title.toLowerCase().includes(search.toLowerCase())) match = false;
      if (allowedServerIds && allowedServerIds.length > 0 && !allowedServerIds.includes(entry.serverId)) match = false;
      return match;
    });

  return {
    data: historyEntries,
    totalActionCount: totalCount,
    activeSessions: activeHistory,
  };
};

export type AllHistoryParams = {
  start?: number;
  end?: number;
  userId?: string;
  serverId?: string;
  limit?: number;
  offset?: number;
  /** Authorization scope: when set, only these servers' rows are visible. */
  allowedServerIds?: string[];
};

export const getAllHistory = (params: AllHistoryParams = {}): HistoryEntry[] => {
  const { start, end, userId, serverId, limit, offset, allowedServerIds } = params;
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (allowedServerIds && allowedServerIds.length > 0) {
    conditions.push(`h.serverId IN (${allowedServerIds.map(() => "?").join(",")})`);
    args.push(...allowedServerIds);
  }

  if (start) {
    conditions.push("h.startTime >= ?");
    args.push(start);
  }

  if (end) {
    conditions.push("h.startTime <= ?");
    args.push(end);
  }

  if (userId) {
    conditions.push("h.userId = ?");
    args.push(resolveUserFilter(userId));
  }

  if (serverId && serverId !== "all") {
    conditions.push("h.serverId = ?");
    args.push(serverId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitClause =
    limit !== undefined ? `LIMIT ${Math.max(0, limit)} OFFSET ${Math.max(0, offset ?? 0)}` : "";

  const query = `
    SELECT h.*, s.name as serverName
    FROM activity_history h
    LEFT JOIN servers s ON h.serverId = s.id
    ${whereClause}
    ORDER BY h.startTime ASC
    ${limitClause}
  `;

  return db.prepare(query).all(...args) as HistoryEntry[];
};

/**
 * Fetch all history rows matching any of the given (serverId, ratingKey) pairs,
 * newest first. Used by media stats to aggregate plays for a merged item that
 * may map to different ratingKeys across servers.
 */
export const getHistoryBySourceKeys = (
  sources: { serverId: string; ratingKey: string }[]
): HistoryEntry[] => {
  if (sources.length === 0) return [];

  const placeholders = sources.map(() => "(h.serverId = ? AND h.ratingKey = ?)").join(" OR ");
  const args = sources.flatMap((s) => [s.serverId, s.ratingKey]);

  const query = `
    SELECT h.*, s.name as serverName
    FROM activity_history h
    LEFT JOIN servers s ON h.serverId = s.id
    WHERE ${placeholders}
    ORDER BY h.startTime DESC
  `;

  return db.prepare(query).all(...args) as HistoryEntry[];
};
