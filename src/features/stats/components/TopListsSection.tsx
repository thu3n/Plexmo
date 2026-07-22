"use client";

import { useLanguage } from "@/components/LanguageContext";
import { TopList, formatWatchTime } from "./TopList";
import { MediaTopList } from "./MediaTopList";
import { useHomeStats } from "../hooks/useStatsData";

/**
 * The six top-list cards of the merged statistics page: three media lists
 * (Popular/Most Watched toggles, posters preloaded) plus users, platforms and
 * plays-per-server from the home-stats bundle.
 */
export function TopListsSection({ days, serverId }: { days: number; serverId: string | null }) {
    const { t } = useLanguage();
    const { data: home, error: homeError, isLoading: homeLoading } = useHomeStats(
        days,
        serverId,
        undefined,
        { media: false },
    );
    const isLoading = homeLoading && !home;

    return (
        <section className="space-y-6">
            {homeError && (
                <div className="rounded-2xl glass-panel border border-rose-500/20 p-6 text-center text-rose-200">
                    {homeError.message}
                </div>
            )}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <MediaTopList type="movie" days={days} serverId={serverId} />
                <MediaTopList type="show" days={days} serverId={serverId} />
                <MediaTopList type="episode" days={days} serverId={serverId} />
                <TopList
                    title={t("statistics.lists.topUsers")}
                    emptyText={t("statistics.empty")}
                    isLoading={isLoading}
                    items={(home?.topUsers ?? []).map((u) => ({
                        key: u.accountId,
                        label: u.user,
                        value: u.plays,
                        valueLabel: `${u.plays} · ${formatWatchTime(u.duration)}`,
                    }))}
                />
                <TopList
                    title={t("statistics.lists.topPlatforms")}
                    emptyText={t("statistics.empty")}
                    isLoading={isLoading}
                    items={(home?.topPlatforms ?? []).map((p) => ({
                        key: p.platform,
                        label: p.platform,
                        value: p.plays,
                        valueLabel: `${p.plays} · ${formatWatchTime(p.duration)}`,
                    }))}
                />
                <TopList
                    title={t("statistics.lists.playsPerServer")}
                    emptyText={t("statistics.empty")}
                    isLoading={isLoading}
                    items={(home?.playsPerServer ?? []).map((s) => ({
                        key: s.serverId,
                        label: s.serverName || "Unknown server",
                        value: s.plays,
                        valueLabel: `${s.plays} · ${formatWatchTime(s.duration)}`,
                    }))}
                />
            </div>
        </section>
    );
}
