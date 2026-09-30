"use client";

import Link from "next/link";
import type { TitleEpisodeRow } from "@/lib/stats/title-detail";
import { EmptyRow, Panel } from "../Panel";
import { formatCount } from "../../lib/overview-math";
import { formatCompletion, groupBySeason, titleHref } from "../../lib/explore-math";

const GRID = "grid grid-cols-[3.25rem_minmax(0,1fr)_3rem_3rem_3.75rem] items-center gap-x-3";

/** Per-episode plays for a show, grouped by season — where the audience starts, stays and drops off. */
export function TitleEpisodesPanel({ episodes }: { episodes: TitleEpisodeRow[] }) {
    const seasons = groupBySeason(episodes);
    const max = Math.max(...episodes.map((e) => e.plays), 1);

    return (
        <Panel id="episodes" title="Episodes">
            {episodes.length === 0 ? (
                <EmptyRow text="No episode was played in the period" />
            ) : (
                <div className="max-h-[32rem] overflow-y-auto pr-1">
                    <div className={`${GRID} pb-2 text-[11px] uppercase tracking-wide text-white/40`}>
                        <span />
                        <span />
                        <span className="text-right">Plays</span>
                        <span className="text-right">Users</span>
                        <span className="text-right">Avg done</span>
                    </div>
                    {seasons.map((group) => (
                        <section key={group.season ?? "none"} className="mb-3 last:mb-0">
                            <h3 className="mb-1 text-xs font-semibold text-white/70">
                                {group.season === null ? "Unknown season" : group.season === 0 ? "Specials" : `Season ${group.season}`}
                            </h3>
                            <ol className="space-y-0.5">
                                {group.episodes.map((e) => (
                                    <li key={e.mediaId} className={`${GRID} rounded-lg py-1 text-[13px] hover:bg-white/[0.03]`}>
                                        <span className="text-xs tabular-nums text-white/45">E{e.episodeNumber ?? "?"}</span>
                                        <div className="min-w-0">
                                            <Link href={titleHref(e.mediaId)} className="block truncate text-white hover:text-amber-300">
                                                {e.title}
                                            </Link>
                                            <div className="mt-1 h-[3px] rounded-full bg-white/[0.06]">
                                                <div
                                                    className="h-full rounded-full bg-amber-400/80"
                                                    style={{ width: `${Math.max(2, (e.plays / max) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <span className="text-right font-semibold tabular-nums text-white">{formatCount(e.plays)}</span>
                                        <span className="text-right tabular-nums text-white/70">{formatCount(e.uniqueUsers)}</span>
                                        <span className="text-right tabular-nums text-white/70">{formatCompletion(e.avgCompletion)}</span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                    ))}
                </div>
            )}
        </Panel>
    );
}
