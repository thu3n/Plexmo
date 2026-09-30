"use client";

import type { CoverageSection } from "@/lib/stats/library-value-timing";
import type { LibraryMediaType } from "@/lib/stats/library-value-query";
import { SkeletonRows } from "@/components/Skeleton";
import { EmptyRow, Panel } from "../Panel";
import { formatCount, formatShare, percentOf } from "../../lib/overview-math";
import { INSET_CLASS } from "../../lib/theme";
import { useLibraryValue } from "../../hooks/library";

const TYPE_LABELS: Record<LibraryMediaType, string> = { movie: "Movies", show: "Shows" };

function Meter({ played, total }: { played: number; total: number }) {
    return (
        <div className="h-1.5 rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-amber-400/80" style={{ width: `${percentOf(played, total)}%` }} />
        </div>
    );
}

function SectionRow({ section, showServer }: { section: CoverageSection; showServer: boolean }) {
    return (
        <li>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-white/85">
                    {section.sectionTitle ?? section.sectionKey}
                    {showServer && section.serverName && <span className="text-white/45"> · {section.serverName}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-white">
                    {formatShare(section.played, section.total)}
                    <span className="ml-1.5 text-[11px] text-white/45">
                        {formatCount(section.played)}/{formatCount(section.total)}
                    </span>
                </span>
            </div>
            <Meter played={section.played} total={section.total} />
        </li>
    );
}

/** Share of the library that has ever been played — per type, then per section. */
export function CoveragePanel({ serverId }: { serverId: string | null }) {
    const coverage = useLibraryValue(serverId)?.coverage;
    const types = coverage
        ? (Object.keys(TYPE_LABELS) as LibraryMediaType[]).filter((t) => coverage.byType[t].total > 0)
        : [];
    const showServer = new Set(coverage?.sections.map((s) => s.serverId)).size > 1;

    return (
        <Panel id="library-coverage" title="Library coverage">
            <p className="-mt-2 mb-3 text-[11px] text-white/45">Titles played at least once, all time</p>
            {!coverage && <SkeletonRows count={4} rowClassName="h-8 rounded-lg" />}
            {coverage && coverage.sections.length === 0 && <EmptyRow text="No library inventory yet" />}
            {coverage && coverage.sections.length > 0 && (
                <>
                    <div className="mb-4 grid grid-cols-2 gap-2">
                        {types.map((t) => (
                            <div key={t} className={`${INSET_CLASS} min-w-0 p-3`}>
                                <p className="text-[11px] uppercase tracking-wide text-white/45">{TYPE_LABELS[t]}</p>
                                <p className="text-xl font-semibold tabular-nums text-amber-400">
                                    {formatShare(coverage.byType[t].played, coverage.byType[t].total)}
                                </p>
                                <p className="truncate text-[11px] text-white/55">
                                    {formatCount(coverage.byType[t].played)} of {formatCount(coverage.byType[t].total)}
                                </p>
                            </div>
                        ))}
                    </div>
                    <ul className="space-y-2.5">
                        {coverage.sections.map((s) => (
                            <SectionRow key={`${s.serverId}:${s.sectionKey}`} section={s} showServer={showServer} />
                        ))}
                    </ul>
                </>
            )}
        </Panel>
    );
}
