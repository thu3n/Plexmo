import { db } from "../db";
import { windowSql, type TitleWindow } from "./title-detail-query";

/**
 * Sessions behind one cell of the weekday × hour activity heatmap. The cell
 * key uses the same local-time strftime('%w') / ('%H') expressions as the
 * plays_by_dow_hour graph, so the list always adds up to the cell's count.
 */

export const DEFAULT_HEATMAP_SESSION_LIMIT = 50;
export const WEEKDAY_COUNT = 7;
export const HOURS_PER_DAY = 24;

export type HeatmapSession = {
    id: string;
    serverId: string;
    serverName: string | null;
    user: string;
    title: string;
    subtitle: string | null;
    startTime: number;
    seconds: number;
    decision: string | null;
    /** Movie or show id for the title page (episodes roll up to their show); null when unmatched. */
    titleMediaId: number | null;
};

export type HeatmapSessionsResult = { total: number; sessions: HeatmapSession[] };

export type HeatmapCell = {
    /** 0 = Sunday .. 6 = Saturday (SQLite %w). */
    weekday: number;
    hour: number;
};

export const isValidHeatmapCell = ({ weekday, hour }: HeatmapCell): boolean =>
    Number.isInteger(weekday) && weekday >= 0 && weekday < WEEKDAY_COUNT &&
    Number.isInteger(hour) && hour >= 0 && hour < HOURS_PER_DAY;

const CELL_SQL = `strftime('%w', datetime(h.startTime / 1000, 'unixepoch', 'localtime')) = ?
    AND strftime('%H', datetime(h.startTime / 1000, 'unixepoch', 'localtime')) = ?`;

export const getHeatmapSessions = (
    cell: HeatmapCell,
    window: TitleWindow,
    limit: number = DEFAULT_HEATMAP_SESSION_LIMIT,
): HeatmapSessionsResult => {
    const scope = windowSql(window);
    const cellArgs = [String(cell.weekday), String(cell.hour).padStart(2, "0")];
    const where = `${scope.sql} AND ${CELL_SQL}`;
    const args = [...scope.args, ...cellArgs];

    const { total } = db.prepare(`SELECT COUNT(*) as total FROM activity_history h WHERE ${where}`)
        .get(...args) as { total: number };
    const sessions = db.prepare(`
        SELECT h.id, h.serverId, s.name as serverName,
               COALESCE(ui.title, h.user) as user,
               h.title, h.subtitle, h.startTime,
               COALESCE(h.play_duration, h.duration) as seconds,
               h.transcode_decision as decision,
               CASE WHEN m.type IN ('movie', 'episode') THEN COALESCE(m.showMediaId, m.id) END as titleMediaId
        FROM activity_history h
        LEFT JOIN servers s ON h.serverId = s.id
        LEFT JOIN user_identities ui ON h.userId = ui.accountId
        LEFT JOIN media_items m ON h.mediaId = m.id
        WHERE ${where}
        ORDER BY h.startTime DESC
        LIMIT ?
    `).all(...args, limit) as HeatmapSession[];
    return { total, sessions };
};
