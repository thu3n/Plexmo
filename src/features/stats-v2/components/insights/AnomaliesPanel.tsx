"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { SkeletonRows } from "@/components/Skeleton";
import type { AnomalyListItem } from "@/lib/stats/anomalies-describe";
import { EmptyRow, Panel } from "../Panel";
import { INSET_CLASS } from "../../lib/theme";
import { useAnomalies } from "../../hooks/insights";
import { SEVERITY_STYLES, formatAgo, isOngoing } from "./anomaly-format";

function AnomalyRow({ item, now }: { item: AnomalyListItem; now: number }) {
    const [open, setOpen] = useState(false);
    const style = SEVERITY_STYLES[item.severity];
    const ongoing = isOngoing(item.firstDetectedAt, item.lastSeenAt);

    return (
        <li className={clsx(INSET_CLASS, "px-3 py-2.5")}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-start gap-3 text-left"
            >
                <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", style.dot)} aria-hidden />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-[13px] font-medium text-white">{item.headline}</p>
                        <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", style.pill)}>
                            {style.label}
                        </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-white/55">
                        {item.serverName ?? item.serverId} · {ongoing ? `ongoing since ${formatAgo(item.firstDetectedAt, now)}` : formatAgo(item.lastSeenAt, now)}
                    </p>
                </div>
                <ChevronDown className={clsx("mt-1 h-4 w-4 shrink-0 text-white/40 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="mt-2 space-y-2 pl-5 text-[12px] leading-relaxed">
                    <p className="text-white/75">{item.detail}</p>
                    <p className="text-white/55">
                        <span className="font-medium text-amber-300/90">What to check: </span>
                        {item.hint}
                    </p>
                </div>
            )}
        </li>
    );
}

/** Incidents from the daily anomaly scan (src/lib/stats/anomalies-job.ts), most recent first. */
export function AnomaliesPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const { items, days: windowDays, error } = useAnomalies(days, serverId);
    const [now] = useState(() => Date.now());

    return (
        <Panel id="anomalies" title="Anomalies" className="flex flex-col">
            <p className="-mt-2 mb-3 text-[11px] text-white/45">
                Checked daily: last 24h vs the 14 days before
            </p>
            {error ? (
                <EmptyRow text="Could not load anomalies" />
            ) : !items ? (
                <SkeletonRows count={3} rowClassName="h-12 rounded-xl" />
            ) : items.length === 0 ? (
                <EmptyRow text={`Nothing unusual in the last ${windowDays ?? days} days`} />
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => <AnomalyRow key={item.id} item={item} now={now} />)}
                </ul>
            )}
        </Panel>
    );
}
