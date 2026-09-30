"use client";

import { SkeletonRows } from "@/components/Skeleton";
import type { TitleServerRow, TitleShareRow } from "@/lib/stats/title-detail";
import { EmptyRow, Panel } from "../Panel";
import { RankedList } from "../RankedList";
import { formatCount, formatHours, formatShare, groupResolutions } from "../../lib/overview-math";
import { DECISION_COLORS } from "../../lib/theme";

/** Same order and colours as the overview's Stream decision panel and the dashboard Streams card. */
const DECISIONS = [
    { bucket: "direct play", label: "Direct Play", color: DECISION_COLORS.directPlay },
    { bucket: "direct stream", label: "Direct Stream", color: DECISION_COLORS.directStream },
    { bucket: "transcode", label: "Transcode", color: DECISION_COLORS.transcode },
] as const;

// A sub-1% share still gets a visible sliver.
const MIN_SEGMENT_PERCENT = 1;
const SKELETON_ROWS = 4;

/** How this title was delivered: decision split (sessions) and delivered resolution. */
export function TitleQualityPanel({
    decisions,
    resolutions,
}: {
    decisions: TitleShareRow[] | undefined;
    resolutions: TitleShareRow[] | undefined;
}) {
    if (!decisions || !resolutions) {
        return <Panel title="Delivered quality"><SkeletonRows count={SKELETON_ROWS} rowClassName="h-8 rounded-lg" /></Panel>;
    }
    const total = decisions.reduce((sum, r) => sum + r.total, 0);
    const rows = DECISIONS.map((d) => ({ ...d, count: decisions.find((r) => r.bucket === d.bucket)?.total ?? 0 }));
    const qualities = groupResolutions(resolutions);
    const qualityTotal = qualities.reduce((sum, q) => sum + q.total, 0);

    return (
        <Panel title="Delivered quality" className="flex flex-col">
            {total === 0 ? (
                <EmptyRow />
            ) : (
                <div className="flex flex-1 flex-col gap-5">
                    <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/5">
                        {rows.filter((r) => r.count > 0).map((r) => (
                            <div
                                key={r.bucket}
                                className="h-full first:rounded-l-full last:rounded-r-full"
                                style={{ width: `${Math.max((r.count / total) * 100, MIN_SEGMENT_PERCENT)}%`, backgroundColor: r.color }}
                            />
                        ))}
                    </div>
                    <ul className="space-y-2.5">
                        {rows.map((r) => (
                            <li key={r.bucket} className="flex items-center justify-between gap-3 text-[13px]">
                                <span className="flex items-center gap-2 text-white/85">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                                    {r.label}
                                </span>
                                <span className="flex items-baseline gap-2 tabular-nums">
                                    <span className="text-[11px] text-white/45">{formatCount(r.count)}</span>
                                    <span className="w-10 text-right font-semibold text-white">{formatShare(r.count, total)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                    {qualities.length > 0 && (
                        <div>
                            <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">Resolution delivered</p>
                            <div className="flex flex-wrap gap-2">
                                {qualities.map((q) => (
                                    <span key={q.label} className="rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-xs text-white/80">
                                        {q.label} <span className="tabular-nums text-white/50">{formatShare(q.total, qualityTotal)}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Panel>
    );
}

/** Where this title was watched — only servers inside the viewer's scope ever appear. */
export function TitleServersPanel({ servers }: { servers: TitleServerRow[] | undefined }) {
    return (
        <Panel title="Per server" className="flex flex-col">
            <div className="flex-1">
                <RankedList
                    columns={["Plays", "Watched"]}
                    skeletonRows={SKELETON_ROWS}
                    rows={servers?.map((s) => ({
                        key: s.serverId,
                        label: s.serverName ?? s.serverId,
                        sub: `${formatCount(s.sessions)} sessions`,
                        values: [formatCount(s.plays), formatHours(s.seconds)],
                        magnitude: s.plays,
                    }))}
                />
            </div>
        </Panel>
    );
}
