import { db } from "../db";
import { MIN_PLAY_PERCENT, MIN_PLAY_SECONDS_FALLBACK } from "./play-thresholds";

/**
 * Tautulli-style "home stats": top users / movies / shows / platforms over a
 * time window, aggregated across servers on canonical identities (accountId,
 * mediaId) — never on display names or per-server ratingKeys. All queries
 * honour the viewer's server scope.
 */

const DEFAULT_TOP_LIMIT = 10;

/**
 * A history row counts as a PLAY for top-media stats only if the viewer got
 * meaningfully into the item: >= 20% of the runtime, or (when completion is
 * unknown, e.g. imports without view offset) >= 10 minutes of play time.
 * Thresholds shared with the streak logic (play-thresholds.ts). On top of
 * that, plays are deduped per (user, calendar day): ten 5-minute restarts are
 * zero plays, and one real viewing session split into three rows is one play
 * — Tautulli-style.
 */

const QUALIFIED_PLAY = `(
  h.percent_complete >= ${MIN_PLAY_PERCENT}
  OR (h.percent_complete IS NULL AND COALESCE(h.play_duration, h.duration) >= ${MIN_PLAY_SECONDS_FALLBACK})
)`;

const PLAY_COUNT = `COUNT(DISTINCT h.userId || ':' ||
  strftime('%Y-%m-%d', datetime(h.startTime / 1000, 'unixepoch', 'localtime')))`;

export type HomeStatsParams = {
  /** Window start, epoch ms. */
  since: number;
  /** Explicit server filter (already scope-checked by the route). */
  serverId?: string;
  /** Authorization scope: when set, only these servers' rows are counted. */
  allowedServerIds?: string[];
  /** Canonical accountId — restricts every stat to one identity's rows. */
  userId?: string;
  limit?: number;
  /** Top-media ranking metric. Defaults to plays. */
  orderBy?: TopMediaOrder;
};

export type TopMediaOrder = "plays" | "uniqueUsers";

// Constant whitelist — orderBy is interpolated into SQL, never user input.
const ORDER_SQL: Record<TopMediaOrder, string> = {
  plays: "plays DESC",
  uniqueUsers: "uniqueUsers DESC, plays DESC",
};

export const buildFilter = ({ since, serverId, allowedServerIds, userId }: HomeStatsParams) => {
  const conditions: string[] = ["h.startTime >= ?"];
  const args: (string | number)[] = [since];

  if (allowedServerIds && allowedServerIds.length > 0) {
    conditions.push(`h.serverId IN (${allowedServerIds.map(() => "?").join(",")})`);
    args.push(...allowedServerIds);
  }
  if (serverId && serverId !== "all") {
    conditions.push("h.serverId = ?");
    args.push(serverId);
  }
  if (userId) {
    conditions.push("h.userId = ?");
    args.push(userId);
  }
  return { where: conditions.join(" AND "), args };
};

export const getTopUsers = (params: HomeStatsParams) => {
  const { where, args } = buildFilter(params);
  return db.prepare(`
    SELECT
      h.userId as accountId,
      COALESCE(ui.title, h.user) as user,
      ui.thumb as thumb,
      COUNT(*) as plays,
      SUM(COALESCE(h.play_duration, h.duration)) as duration,
      MAX(h.stopTime) as lastPlayed
    FROM activity_history h
    LEFT JOIN user_identities ui ON h.userId = ui.accountId
    WHERE ${where}
    GROUP BY h.userId
    ORDER BY plays DESC
    LIMIT ?
  `).all(...args, params.limit ?? DEFAULT_TOP_LIMIT);
};

export const getTopMovies = (params: HomeStatsParams) => {
  const { where, args } = buildFilter(params);
  return db.prepare(`
    SELECT
      m.id as mediaId,
      m.title,
      m.year,
      ${PLAY_COUNT} as plays,
      COUNT(DISTINCT h.userId) as uniqueUsers,
      SUM(COALESCE(h.play_duration, h.duration)) as duration,
      MAX(h.stopTime) as lastPlayed
    FROM activity_history h
    JOIN media_items m ON h.mediaId = m.id AND m.type = 'movie'
    WHERE ${where} AND ${QUALIFIED_PLAY}
    GROUP BY m.id
    ORDER BY ${ORDER_SQL[params.orderBy ?? "plays"]}
    LIMIT ?
  `).all(...args, params.limit ?? DEFAULT_TOP_LIMIT);
};

export const getTopShows = (params: HomeStatsParams) => {
  const { where, args } = buildFilter(params);
  // Shows: a play is a qualified (user, day, EPISODE) — two different
  // episodes the same evening are two plays, but restarting one episode
  // five times is one.
  return db.prepare(`
    SELECT
      p.id as mediaId,
      p.title,
      p.year,
      COUNT(DISTINCT h.userId || ':' || h.mediaId || ':' ||
        strftime('%Y-%m-%d', datetime(h.startTime / 1000, 'unixepoch', 'localtime'))) as plays,
      COUNT(DISTINCT h.userId) as uniqueUsers,
      SUM(COALESCE(h.play_duration, h.duration)) as duration,
      MAX(h.stopTime) as lastPlayed
    FROM activity_history h
    JOIN media_items e ON h.mediaId = e.id AND e.showMediaId IS NOT NULL
    JOIN media_items p ON e.showMediaId = p.id
    WHERE ${where} AND ${QUALIFIED_PLAY}
    GROUP BY p.id
    ORDER BY ${ORDER_SQL[params.orderBy ?? "plays"]}
    LIMIT ?
  `).all(...args, params.limit ?? DEFAULT_TOP_LIMIT);
};

export const getTopEpisodes = (params: HomeStatsParams) => {
  const { where, args } = buildFilter(params);
  // Episodes: same (user, day) dedupe as movies — the grain IS the episode.
  // showMediaId is returned so callers can fall back to the show's poster
  // (the library inventory carries no per-episode art).
  return db.prepare(`
    SELECT
      e.id as mediaId,
      e.title,
      e.year,
      e.showMediaId,
      e.seasonNumber,
      e.episodeNumber,
      p.title as showTitle,
      ${PLAY_COUNT} as plays,
      COUNT(DISTINCT h.userId) as uniqueUsers,
      SUM(COALESCE(h.play_duration, h.duration)) as duration,
      MAX(h.stopTime) as lastPlayed
    FROM activity_history h
    JOIN media_items e ON h.mediaId = e.id AND e.type = 'episode'
    LEFT JOIN media_items p ON e.showMediaId = p.id
    WHERE ${where} AND ${QUALIFIED_PLAY}
    GROUP BY e.id
    ORDER BY ${ORDER_SQL[params.orderBy ?? "plays"]}
    LIMIT ?
  `).all(...args, params.limit ?? DEFAULT_TOP_LIMIT);
};

export const getTopPlatforms = (params: HomeStatsParams) => {
  const { where, args } = buildFilter(params);
  return db.prepare(`
    SELECT
      h.platform,
      COUNT(*) as plays,
      COUNT(DISTINCT h.userId) as uniqueUsers,
      SUM(COALESCE(h.play_duration, h.duration)) as duration
    FROM activity_history h
    WHERE ${where} AND h.platform IS NOT NULL
    GROUP BY h.platform
    ORDER BY plays DESC
    LIMIT ?
  `).all(...args, params.limit ?? DEFAULT_TOP_LIMIT);
};

/** Per-server play counts for the window — the multi-server breakdown row. */
export const getPlaysPerServer = (params: HomeStatsParams) => {
  const { where, args } = buildFilter(params);
  return db.prepare(`
    SELECT
      h.serverId,
      s.name as serverName,
      COUNT(*) as plays,
      SUM(COALESCE(h.play_duration, h.duration)) as duration
    FROM activity_history h
    LEFT JOIN servers s ON h.serverId = s.id
    WHERE ${where}
    GROUP BY h.serverId
    ORDER BY plays DESC
  `).all(...args);
};

export const getHomeStats = (params: HomeStatsParams) => ({
  topUsers: getTopUsers(params),
  topMovies: getTopMovies(params),
  topShows: getTopShows(params),
  topPlatforms: getTopPlatforms(params),
  playsPerServer: getPlaysPerServer(params),
});
