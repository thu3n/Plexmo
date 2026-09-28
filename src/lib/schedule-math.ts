/** Pure next-run arithmetic for the Settings → Jobs schedule table. */

/** Interval gated on its own last run ("at most every N"): next = last + N, never in the past. */
export const nextRunAfter = (lastRunMs: number | null, intervalMs: number, nowMs: number): number | null => {
    if (lastRunMs === null) return null;
    return Math.max(lastRunMs + intervalMs, nowMs);
};

/** setInterval started at `anchorMs` (process start): the next tick strictly after now. */
export const nextAlignedRun = (anchorMs: number, intervalMs: number, nowMs: number): number => {
    if (nowMs < anchorMs) return anchorMs;
    const elapsedTicks = Math.floor((nowMs - anchorMs) / intervalMs) + 1;
    return anchorMs + elapsedTicks * intervalMs;
};

/** Start of the local calendar day containing `nowMs`. */
export const localMidnight = (nowMs: number): number => {
    const d = new Date(nowMs);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Start of the next local calendar day after `nowMs`. */
export const nextLocalMidnight = (nowMs: number): number => {
    const d = new Date(nowMs);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
};

/** "YYYY-MM-DD" local-date key → epoch ms of that local midnight, or null if malformed. */
export const localDateKeyToMs = (key: string | undefined | null): number | null => {
    if (!key) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
};
