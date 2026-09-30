import { db } from "../db";
import { MIN_PLAY_PERCENT, MIN_PLAY_SECONDS_FALLBACK } from "./play-thresholds";

/**
 * Shared SQL building blocks for the title drill-down (title-detail*.ts).
 * Play qualification and dedupe mirror home-stats' top lists exactly, so the
 * play count on a title page equals the number on the row the user clicked.
 */

export type TitleType = "movie" | "show" | "episode";

export type TitleRef = {
    mediaId: number;
    type: TitleType;
    title: string;
    year: number | null;
    showMediaId: number | null;
    showTitle: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
};

export type TitleWindow = {
    /** Window start, epoch ms. */
    since: number;
    /** Exclusive window end, epoch ms (default: open-ended). */
    until?: number;
    /** Explicit server filter (already scope-checked by the route). */
    serverId?: string;
    /** Authorization scope: when set, only these servers' rows are visible. */
    allowedServerIds?: string[];
};

export type SqlFragment = { sql: string; args: (string | number)[] };

export const QUALIFIED_PLAY = `(
  h.percent_complete >= ${MIN_PLAY_PERCENT}
  OR (h.percent_complete IS NULL AND COALESCE(h.play_duration, h.duration) >= ${MIN_PLAY_SECONDS_FALLBACK})
)`;

export const LOCAL_DAY = `strftime('%Y-%m-%d', datetime(h.startTime / 1000, 'unixepoch', 'localtime'))`;

/** Show plays count per (user, episode, day); movie/episode plays per (user, day) — as in home-stats. */
export const playCountSql = (type: TitleType): string =>
    type === "show"
        ? `COUNT(DISTINCT CASE WHEN ${QUALIFIED_PLAY} THEN h.userId || ':' || h.mediaId || ':' || ${LOCAL_DAY} END)`
        : `COUNT(DISTINCT CASE WHEN ${QUALIFIED_PLAY} THEN h.userId || ':' || ${LOCAL_DAY} END)`;

export const scopeSql = (column: string, allowedServerIds?: string[]): SqlFragment =>
    allowedServerIds && allowedServerIds.length > 0
        ? { sql: ` AND ${column} IN (${allowedServerIds.map(() => "?").join(",")})`, args: allowedServerIds }
        : { sql: "", args: [] };

/** Rows belonging to the title: a show matches every one of its episodes. */
export const titleMatchSql = (ref: Pick<TitleRef, "mediaId" | "type">): SqlFragment =>
    ref.type === "show"
        ? { sql: "h.mediaId IN (SELECT id FROM media_items WHERE showMediaId = ?)", args: [ref.mediaId] }
        : { sql: "h.mediaId = ?", args: [ref.mediaId] };

/** Window + server + scope conditions on `h` (without a leading AND). */
export const windowSql = ({ since, until, serverId, allowedServerIds }: TitleWindow): SqlFragment => {
    const parts = ["h.startTime >= ?"];
    const args: (string | number)[] = [since];
    if (until !== undefined) {
        parts.push("h.startTime < ?");
        args.push(until);
    }
    if (serverId && serverId !== "all") {
        parts.push("h.serverId = ?");
        args.push(serverId);
    }
    const scope = scopeSql("h.serverId", allowedServerIds);
    return { sql: parts.join(" AND ") + scope.sql, args: [...args, ...scope.args] };
};

type MediaRow = {
    id: number;
    type: string;
    title: string;
    year: number | null;
    showMediaId: number | null;
    showTitle: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
};

const TITLE_TYPES: readonly string[] = ["movie", "show", "episode"];

/** Canonical media row, or null when the id is unknown or not a movie/show/episode. */
export const resolveTitle = (mediaId: number): TitleRef | null => {
    const row = db.prepare(`
        SELECT m.id, m.type, m.title, m.year, m.showMediaId, p.title as showTitle,
               m.seasonNumber, m.episodeNumber
        FROM media_items m
        LEFT JOIN media_items p ON m.showMediaId = p.id
        WHERE m.id = ?
    `).get(mediaId) as MediaRow | undefined;
    if (!row || !TITLE_TYPES.includes(row.type)) return null;
    return {
        mediaId: row.id,
        type: row.type as TitleType,
        title: row.title,
        year: row.year,
        showMediaId: row.showMediaId,
        showTitle: row.showTitle,
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
    };
};

/**
 * A scoped viewer may only see a title that exists on (or was played on) one
 * of their servers — otherwise the page would confirm content on servers
 * outside their grant. Unrestricted callers see every known title.
 */
export const isTitleVisible = (ref: TitleRef, allowedServerIds?: string[]): boolean => {
    if (!allowedServerIds || allowedServerIds.length === 0) return true;
    const scope = scopeSql("serverId", allowedServerIds);
    const ids = ref.type === "show"
        ? "(SELECT ? UNION SELECT id FROM media_items WHERE showMediaId = ?)"
        : "(SELECT ?)";
    const idArgs = ref.type === "show" ? [ref.mediaId, ref.mediaId] : [ref.mediaId];
    const hit = db.prepare(`
        SELECT 1 FROM (
            SELECT serverId FROM activity_history WHERE mediaId IN ${ids}${scope.sql}
            UNION ALL
            SELECT serverId FROM library_items WHERE mediaId IN ${ids}${scope.sql}
            UNION ALL
            SELECT serverId FROM media_sources WHERE mediaId IN ${ids}${scope.sql}
        ) LIMIT 1
    `).get(
        ...idArgs, ...scope.args,
        ...idArgs, ...scope.args,
        ...idArgs, ...scope.args,
    );
    return hit !== undefined;
};
