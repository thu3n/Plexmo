/** Pure formatting helpers for the people panels (kept out of JSX so they stay unit-testable). */

const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const HOURS_PER_DAY = 24;
const HOURS_PER_HALF_DAY = 12;

export const formatShortDate = (epochMs: number): string =>
    new Date(epochMs).toLocaleDateString("en-US", DATE_FMT);

/** "76d" — compact "days since" for list value columns. */
export const formatDays = (days: number): string => `${Math.max(0, Math.round(days))}d`;

/** 0-23 -> "9 PM" / "12 AM". */
export const formatHour = (hour: number): string => {
    const h = ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
    const suffix = h < HOURS_PER_HALF_DAY ? "AM" : "PM";
    const display = h % HOURS_PER_HALF_DAY === 0 ? HOURS_PER_HALF_DAY : h % HOURS_PER_HALF_DAY;
    return `${display} ${suffix}`;
};

/** Hour with the most plays, or null when the profile has none. Ties go to the earlier hour. */
export const peakHour = (hours: number[]): number | null => {
    let best: number | null = null;
    hours.forEach((count, hour) => {
        if (count > 0 && (best === null || count > hours[best])) best = hour;
    });
    return best;
};

/** Profile-link target shared with the Top users panel. */
export const userHref = (user: string): string =>
    `/settings/users/${encodeURIComponent(user)}?from=statistics`;
