"use client";

import { CheckCircle2, Clock, Play, User, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { buildThumbUrl } from "@/features/stats/lib/top-media-list";
import { PANEL_CLASS } from "../Panel";
import { formatCount, formatHours, formatWatchTime } from "../../lib/overview-math";
import { formatCompletion, formatTitleMeta } from "../../lib/explore-math";
import type { TitleDetailResponse } from "../../hooks/explore";

/** 2:3 poster at up to 3x DPR of the 96x144 render size. */
const HERO_THUMB = { w: 288, h: 432 };
const STAT_COUNT = 4;

const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const formatDate = (t: number) => new Date(t).toLocaleDateString("en-US", DATE_FMT);

type Stat = { label: string; value: string; icon: LucideIcon; title?: string };

function StatTile({ stat }: { stat: Stat }) {
    const Icon = stat.icon;
    return (
        <div className={`${PANEL_CLASS} flex items-start gap-3 p-4`} title={stat.title}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-amber-400 ring-1 ring-white/10">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{stat.label}</p>
                <p className="truncate text-xl font-semibold leading-tight tabular-nums text-white sm:text-2xl">{stat.value}</p>
            </div>
        </div>
    );
}

export function TitleHero({ detail, isClient }: { detail: TitleDetailResponse | undefined; isClient: boolean }) {
    if (!detail) {
        return (
            <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
                <Skeleton className="h-36 w-full rounded-2xl lg:w-[420px]" />
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {Array.from({ length: STAT_COUNT }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)}
                </div>
            </div>
        );
    }

    const { title, summary } = detail;
    const src = buildThumbUrl(title.thumb, HERO_THUMB);
    const stats: Stat[] = [
        { label: "Plays", value: formatCount(summary.plays), icon: Play, title: `${formatCount(summary.sessions)} sessions in total` },
        { label: "Unique users", value: formatCount(summary.uniqueUsers), icon: User },
        { label: "Watch time", value: formatWatchTime(summary.totalSeconds), icon: Clock, title: `${formatHours(summary.totalSeconds)} in total` },
        { label: "Avg completion", value: formatCompletion(summary.avgCompletion), icon: CheckCircle2, title: "Mean of each viewer's furthest point" },
    ];

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className={`${PANEL_CLASS} flex items-center gap-4 p-4`}>
                {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-36 w-24 shrink-0 rounded-lg bg-slate-800 object-cover" />
                ) : (
                    <div className="h-36 w-24 shrink-0 rounded-lg bg-white/5" />
                )}
                <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-amber-400/90">{formatTitleMeta(title)}</p>
                    <h2 className="mt-1 text-xl font-bold leading-tight text-white sm:text-2xl">{title.title}</h2>
                    {isClient && summary.firstPlayed && summary.lastPlayed && (
                        <p className="mt-2 text-xs text-white/55">
                            First played {formatDate(summary.firstPlayed)} · last {formatDate(summary.lastPlayed)}
                        </p>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 content-start gap-3 xl:grid-cols-4">
                {stats.map((stat) => <StatTile key={stat.label} stat={stat} />)}
            </div>
        </div>
    );
}
