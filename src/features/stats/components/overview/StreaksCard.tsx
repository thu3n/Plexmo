"use client";

import { Flame } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { SkeletonRows } from "@/components/Skeleton";
import type { StreakLeaderboardEntry } from "@/lib/stats/streak-leaderboard";
import { avatarSrc } from "@/lib/avatar";
import { STAT_CARD_ICON_TILE_CLASS, STAT_CARD_SHELL_CLASS } from "./stat-card-shell";

/** Top Streaks leaderboard: ranked users with avatar, longest-streak badge and an active-streak flame. */
export function StreaksCard({
    items,
    isLoading,
}: {
    items: StreakLeaderboardEntry[] | undefined;
    isLoading: boolean;
}) {
    const { t } = useLanguage();
    return (
        <div className={STAT_CARD_SHELL_CLASS}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-white/50">{t("statistics.streaks.label")}</p>
                    <p className="text-[10px] text-white/30">{t("statistics.streaks.caption")}</p>
                </div>
                <div className={`${STAT_CARD_ICON_TILE_CLASS} text-orange-400`}>
                    <Flame className="h-4 w-4" />
                </div>
            </div>
            {isLoading && !items ? (
                <div className="mt-3">
                    <SkeletonRows count={3} rowClassName="h-6 rounded-lg" />
                </div>
            ) : !items || items.length === 0 ? (
                <p className="mt-3 text-sm text-white/30">{t("statistics.streaks.empty")}</p>
            ) : (
                <ol className="mt-3 max-h-[88px] space-y-1.5 overflow-y-auto no-scrollbar">
                    {items.map((entry, index) => (
                        <li key={entry.accountId} className="flex items-center gap-2.5">
                            <span className="w-5 shrink-0 text-[10px] font-bold text-white/40">#{index + 1}</span>
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10">
                                {entry.thumb ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={avatarSrc(entry.thumb, entry.user)} alt={entry.user} loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-[11px] font-bold text-white/40">
                                        {entry.user.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/80">{entry.user}</span>
                            {entry.current > 0 && (
                                <span title={t("statistics.streaks.current", { n: String(entry.current) })}>
                                    <Flame className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                                </span>
                            )}
                            <span className="shrink-0 rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                                {entry.longest}d
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
