import type { UserStats } from "@/lib/user_stats";

/**
 * The five selectable periods on the user page. Each chip both displays the
 * period's stats (from UserStats.global) and drives the charts below (days →
 * the graphs API, which clamps to [1, 7300]).
 */
export type PeriodKey = "24h" | "7d" | "30d" | "1y" | "all";

export const USER_PERIODS: {
    key: PeriodKey;
    label: string;
    days: number;
    statKey: keyof UserStats["global"];
}[] = [
    { key: "24h", label: "24h", days: 1, statKey: "last24h" },
    { key: "7d", label: "7d", days: 7, statKey: "last7d" },
    { key: "30d", label: "30d", days: 30, statKey: "last30d" },
    { key: "1y", label: "1y", days: 365, statKey: "last365d" },
    // 20 years predates Plex itself = effectively all time (API MAX_DAYS).
    { key: "all", label: "All time", days: 7300, statKey: "allTime" },
];

export const DEFAULT_PERIOD: PeriodKey = "30d";

export const daysForPeriod = (key: PeriodKey): number =>
    USER_PERIODS.find((p) => p.key === key)?.days ?? 30;
