"use client";

import { Activity, Clock3, Play, Tv } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { SkeletonStatCard } from "@/components/Skeleton";
import { useOverviewSummary, useTopStreaks } from "../../hooks/useOverviewData";
import { ALL_TIME_DAYS } from "../../lib/stats-periods";
import { formatHoursFromSeconds, formatNumber, formatPeakTimestamp } from "../../lib/format";
import { BigStatCard } from "./BigStatCard";
import { StatCarouselCard, type CarouselPage } from "./StatCarouselCard";
import { StreaksCard } from "./StreaksCard";
import { STAT_CARD_VALUE_CLASS } from "./stat-card-shell";

const bigValue = (value: string) => <p className={STAT_CARD_VALUE_CLASS}>{value}</p>;

export function WatchStatsSection({ days, serverId }: { days: number; serverId: string | null }) {
    const { t } = useLanguage();
    const isAllTime = days >= ALL_TIME_DAYS;
    const { data: summary, error, isLoading } = useOverviewSummary(days, serverId);
    const { data: streaksData, isLoading: streaksLoading } = useTopStreaks(serverId);

    const peak = summary ? (isAllTime ? summary.peak.allTime : summary.peak.window) : null;
    const byType = new Map((summary?.playsByType ?? []).map((b) => [b.type, b.plays]));
    const avgHours = summary && summary.uniqueUsers > 0 ? summary.totalSeconds / summary.uniqueUsers : 0;

    const playsPages: CarouselPage[] = [
        {
            key: "total",
            content: (
                <>
                    {bigValue(formatNumber(summary?.totalPlays ?? 0))}
                    <p className="mt-auto pt-2 text-xs text-white/40">{t("statistics.plays.sub")}</p>
                </>
            ),
        },
        {
            key: "byType",
            content: (
                <div className="mt-2 space-y-1.5">
                    {(["movie", "episode", "other"] as const).map((type) => (
                        <div key={type} className="flex items-baseline justify-between">
                            <span className="text-xs text-white/40">{t(`statistics.plays.${type}`)}</span>
                            <span className="font-mono text-sm font-bold text-white/90">
                                {formatNumber(byType.get(type) ?? 0)}
                            </span>
                        </div>
                    ))}
                    <p className="pt-1 text-[10px] uppercase tracking-wider text-white/30">{t("statistics.plays.byType")}</p>
                </div>
            ),
        },
    ];

    const hoursPages: CarouselPage[] = [
        {
            key: "hours",
            content: (
                <>
                    <p className={STAT_CARD_VALUE_CLASS}>
                        {formatHoursFromSeconds(summary?.totalSeconds ?? 0)}
                        <span className="ml-1.5 text-sm font-medium text-white/40">hrs</span>
                    </p>
                    <p className="mt-auto pt-2 text-xs text-white/40">
                        {t("statistics.hours.sub", { n: formatNumber(summary?.uniqueUsers ?? 0) })}
                    </p>
                </>
            ),
        },
        // No standalone unique-users page: the hours page's footer already says
        // "Across N unique users" — a separate page was duplicate information.
        {
            key: "avg",
            content: (
                <>
                    <p className={STAT_CARD_VALUE_CLASS}>
                        {formatHoursFromSeconds(avgHours)}
                        <span className="ml-1.5 text-sm font-medium text-white/40">hrs</span>
                    </p>
                    <p className="mt-auto pt-2 text-xs text-white/40">{t("statistics.hours.avgPerUserSub")}</p>
                </>
            ),
        },
    ];

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2.5">
                <Activity className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold tracking-tight text-white/90">
                    {t("statistics.sections.watchStats")}
                </h2>
            </div>
            {error && (
                <div className="rounded-2xl glass-panel border border-rose-500/20 p-6 text-center text-rose-200">
                    {error.message}
                </div>
            )}
            {isLoading && !summary ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => (
                        <SkeletonStatCard key={i} className="min-h-[120px]" />
                    ))}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <BigStatCard
                        label={t("statistics.concurrent.label")}
                        value={formatNumber(peak?.count ?? 0)}
                        subline={
                            peak && peak.count > 0
                                ? isAllTime
                                    ? t("statistics.concurrent.allTime")
                                    : t("statistics.concurrent.window")
                                : t("statistics.concurrent.none")
                        }
                        detail={peak ? formatPeakTimestamp(peak.timestamp) : null}
                        icon={<Tv className="h-4 w-4" />}
                        accent="text-amber-400"
                    />
                    <StatCarouselCard
                        label={t("statistics.plays.label")}
                        icon={<Play className="h-4 w-4" />}
                        accent="text-sky-400"
                        pages={playsPages}
                    />
                    <StatCarouselCard
                        label={t("statistics.hours.label")}
                        icon={<Clock3 className="h-4 w-4" />}
                        accent="text-violet-400"
                        pages={hoursPages}
                    />
                    <StreaksCard items={streaksData?.items} isLoading={streaksLoading} />
                </div>
            )}
        </section>
    );
}
