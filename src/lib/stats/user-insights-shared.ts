import { MIN_PLAY_PERCENT, MIN_PLAY_SECONDS_FALLBACK } from "./play-thresholds";

/**
 * Shared plumbing for the "people" insights (lifecycle, shared accounts,
 * profiles, genres). Users are grouped on the canonical accountId stored in
 * activity_history.userId (owner alias already translated on write) and named
 * via user_identities — same model as home-stats.
 */

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Window + authorization scope every people query honours. */
export type PeopleScope = {
    /** Window start, epoch ms. */
    since: number;
    /** Exclusive window end, epoch ms (default: now). */
    until?: number;
    /** Explicit server filter (already scope-checked by the route). */
    serverId?: string;
    /** Authorization scope: when set, only these servers' rows are counted. */
    allowedServerIds?: string[];
};

export type ServerScope = Pick<PeopleScope, "serverId" | "allowedServerIds">;

/** Display identity for a canonical account. */
export type PersonRef = { accountId: string; user: string; thumb: string | null };

/**
 * Same "meaningful play" gate as top-media stats (play-thresholds.ts): short
 * restarts and trailers should not shape genre tastes or completion averages.
 */
export const QUALIFIED_PLAY_SQL = `(
  h.percent_complete >= ${MIN_PLAY_PERCENT}
  OR (h.percent_complete IS NULL AND COALESCE(h.play_duration, h.duration) >= ${MIN_PLAY_SECONDS_FALLBACK})
)`;

const placeholders = (count: number) => Array.from({ length: count }, () => "?").join(",");

/** Server-only conditions (no time window) for `h`-aliased activity_history. */
export const buildServerFilter = ({ serverId, allowedServerIds }: ServerScope) => {
    const conditions: string[] = [];
    const args: (string | number)[] = [];
    if (allowedServerIds && allowedServerIds.length > 0) {
        conditions.push(`h.serverId IN (${placeholders(allowedServerIds.length)})`);
        args.push(...allowedServerIds);
    }
    if (serverId && serverId !== "all") {
        conditions.push("h.serverId = ?");
        args.push(serverId);
    }
    return { conditions, args };
};

/** Window + server conditions, joined into a WHERE body (always non-empty). */
export const buildWindowFilter = (scope: PeopleScope & { userId?: string }) => {
    const server = buildServerFilter(scope);
    const conditions = ["h.startTime >= ?", "h.startTime < ?", ...server.conditions];
    const args: (string | number)[] = [scope.since, scope.until ?? Date.now(), ...server.args];
    if (scope.userId) {
        conditions.push("h.userId = ?");
        args.push(scope.userId);
    }
    return { where: conditions.join(" AND "), args };
};

/** `IN (...)` clause restricting an arbitrary serverId column to the auth scope. */
export const scopeColumnFilter = (column: string, allowedServerIds?: string[]) =>
    allowedServerIds && allowedServerIds.length > 0
        ? { sql: ` AND ${column} IN (${placeholders(allowedServerIds.length)})`, args: allowedServerIds }
        : { sql: "", args: [] as string[] };

