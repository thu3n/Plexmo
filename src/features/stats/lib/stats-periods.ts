export type StatsPeriodKey = "24h" | "7d" | "30d" | "90d" | "1y" | "all";

/** 20 years predates Plex itself = effectively all time (the API's MAX_DAYS); the
 *  summary route swaps in the persistent peak record at this threshold. */
export const ALL_TIME_DAYS = 7300;

/** The single page-level period vocabulary — cards, charts and top lists all follow it. */
export const STATS_PERIODS: { key: StatsPeriodKey; days: number; label: string }[] = [
    { key: "24h", days: 1, label: "24h" },
    { key: "7d", days: 7, label: "7d" },
    { key: "30d", days: 30, label: "30d" },
    { key: "90d", days: 90, label: "90d" },
    { key: "1y", days: 365, label: "1y" },
    { key: "all", days: ALL_TIME_DAYS, label: "All Time" },
];

export const daysForStatsPeriod = (key: StatsPeriodKey): number =>
    STATS_PERIODS.find((p) => p.key === key)?.days ?? ALL_TIME_DAYS;
