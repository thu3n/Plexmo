const pad = (n: number) => String(n).padStart(2, "0");

/** Local "2025-03-25 19:42" — the peak-card timestamp subline. */
export const formatPeakTimestamp = (timestamp: number | null): string | null => {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Thousands-separated integer, e.g. 30,407. */
export const formatNumber = (n: number): string => Math.round(n).toLocaleString("en-US");

/** Whole hours from seconds, thousands-separated. */
export const formatHoursFromSeconds = (seconds: number): string =>
    formatNumber(seconds / 3600);
