const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const JUST_NOW_MS = 30 * SECOND_MS;

/** "just now" / "5 min ago" / "3 h ago" / "2 d ago" — compact for a card footer. */
export const formatLastSeen = (iso: string | null, now: number = Date.now()): string | null => {
    if (!iso) return null;
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return null;
    const diff = Math.max(0, now - then);
    if (diff < JUST_NOW_MS) return "just now";
    if (diff < HOUR_MS) return `${Math.max(1, Math.round(diff / MINUTE_MS))} min ago`;
    if (diff < DAY_MS) return `${Math.round(diff / HOUR_MS)} h ago`;
    return `${Math.round(diff / DAY_MS)} d ago`;
};
