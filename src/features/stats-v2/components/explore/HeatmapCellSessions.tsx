"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { SkeletonRows } from "@/components/Skeleton";
import type { HeatmapCell } from "@/lib/stats/heatmap-sessions";
import { EmptyRow } from "../Panel";
import { INSET_CLASS } from "../../lib/theme";
import { formatCount } from "../../lib/overview-math";
import { titleHref } from "../../lib/explore-math";
import { useHeatmapSessions } from "../../hooks/explore";

const SKELETON_ROWS = 4;
const SECONDS_PER_MINUTE = 60;

const WHEN_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" };

const formatMinutes = (seconds: number) => `${formatCount(seconds / SECONDS_PER_MINUTE)} min`;

/** The sessions behind one heatmap cell — newest first, capped by the API. */
export function HeatmapCellSessions({
    cell,
    label,
    days,
    serverId,
    onClose,
}: {
    cell: HeatmapCell;
    /** "Mon 20:00–21:00" */
    label: string;
    days: number;
    serverId: string | null;
    onClose: () => void;
}) {
    const { data } = useHeatmapSessions(cell, days, serverId);
    const shown = data?.sessions.length ?? 0;

    return (
        <div className={`${INSET_CLASS} mt-3 p-3`} role="region" aria-label={`Sessions ${label}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-white/80">
                    {label}
                    {data && (
                        <span className="text-white/50">
                            {" "}· {formatCount(data.total)} sessions{data.total > shown ? `, latest ${shown}` : ""}
                        </span>
                    )}
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close sessions"
                    className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            {!data ? (
                <SkeletonRows count={SKELETON_ROWS} rowClassName="h-8 rounded-lg" />
            ) : data.sessions.length === 0 ? (
                <EmptyRow text="No sessions in this hour" />
            ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {data.sessions.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1 text-xs hover:bg-white/[0.03]">
                            <div className="min-w-0">
                                {s.titleMediaId ? (
                                    <Link href={titleHref(s.titleMediaId)} className="block truncate font-medium text-white hover:text-amber-300">
                                        {s.title}
                                    </Link>
                                ) : (
                                    <p className="truncate font-medium text-white">{s.title}</p>
                                )}
                                <p className="truncate text-[11px] text-white/55">
                                    {s.user}
                                    {s.subtitle ? ` · ${s.subtitle}` : ""}
                                    {s.serverName ? ` · ${s.serverName}` : ""}
                                </p>
                            </div>
                            <div className="shrink-0 text-right tabular-nums">
                                <p className="text-white/80">{new Date(s.startTime).toLocaleString("en-US", WHEN_FMT)}</p>
                                <p className="text-[11px] text-white/45">{formatMinutes(s.seconds)}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
