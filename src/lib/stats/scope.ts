/**
 * Authorization scope: when a viewer is restricted to specific servers, every
 * history/summary query must carry the filter — same pattern as history-read.
 * Shared by user_stats and streaks (kept separate to avoid circular imports).
 */
export const scopeFilter = (column: string, allowedServerIds?: string[]) =>
    allowedServerIds && allowedServerIds.length > 0
        ? { sql: ` AND ${column} IN (${allowedServerIds.map(() => "?").join(",")})`, args: allowedServerIds }
        : { sql: "", args: [] as string[] };
