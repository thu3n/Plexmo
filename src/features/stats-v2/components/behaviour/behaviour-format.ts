/**
 * Pure formatting for the viewing-behaviour panels (no React, unit-testable).
 */

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

/** "S1 · E4", or null when the numbering is unknown. */
export const episodeCode = (season: number | null, episode: number | null): string | null =>
    season === null || episode === null ? null : `S${season} · E${episode}`;

/** "Aug 12, 2026" — absolute, so a render never depends on the current clock. */
export const formatDay = (epochMs: number): string =>
    new Date(epochMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Wall-clock span of a binge: "3h 20m", "45m". */
export const formatSpan = (startMs: number, stopMs: number): string => {
    const minutes = Math.max(0, Math.round((stopMs - startMs) / MS_PER_MINUTE));
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const rest = minutes % MINUTES_PER_HOUR;
    if (hours === 0) return `${rest}m`;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

/** Paused minutes per playback hour: "4.2 min/h". */
export const formatPauseRate = (minutesPerHour: number): string =>
    `${minutesPerHour.toFixed(1)} min/h`;

export const plural = (count: number, one: string, many = `${one}s`): string =>
    `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
