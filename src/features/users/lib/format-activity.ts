const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_DAYS = 30;
const YEAR_DAYS = 365;

/** Compact "last seen" label for the directory cards. */
export const formatLastSeen = (lastPlayedAt: number | null, now: number): string => {
    if (lastPlayedAt === null) return "Never";
    const elapsed = Math.max(0, now - lastPlayedAt);
    if (elapsed < HOUR_MS) return "Just now";
    if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h ago`;
    const days = Math.floor(elapsed / DAY_MS);
    if (days < MONTH_DAYS) return `${days}d ago`;
    if (days < YEAR_DAYS) return `${Math.floor(days / MONTH_DAYS)}mo ago`;
    return `${Math.floor(days / YEAR_DAYS)}y ago`;
};

export const formatPlays = (plays: number): string => `${plays} play${plays === 1 ? "" : "s"}`;
