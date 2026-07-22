"use client";

import type { HistoryEntry } from "@/lib/history";
import { formatDate } from "@/lib/format";
import { ScrollStripArrows } from "@/components/ScrollStripArrows";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { edgeMaskClass, useScrollEdges } from "@/lib/use-scroll-edges";

/**
 * Recently played posters: one horizontally scrolling strip at every
 * breakpoint — same pattern as the dashboard's Recently Added row, plus
 * clickable edge arrows for mouse users.
 */
export function UserRecentlyPlayed({
    entries,
    onSelect,
}: {
    entries: HistoryEntry[];
    onSelect: (entry: HistoryEntry) => void;
}) {
    const { ref, handlers } = useDragScroll<HTMLDivElement>();
    const edges = useScrollEdges(ref, [entries]);
    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="mb-6 text-xl font-bold text-white">Recently Played</h2>
            <div className="relative">
                <ScrollStripArrows scrollRef={ref} edges={edges} />
                <div
                    ref={ref}
                    {...handlers}
                    className={`flex w-full gap-4 overflow-x-auto pb-4 no-scrollbar select-none cursor-grab active:cursor-grabbing ${edgeMaskClass(edges)}`}
                >
                    {entries.map((entry, i) => (
                        <div
                            key={`${entry.id}-${i}`}
                            className="group relative aspect-[2/3] min-w-[160px] w-[160px] overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/10 transition-all hover:scale-105 hover:ring-amber-500/50 hover:shadow-lg hover:shadow-black/50 shrink-0 flex flex-col cursor-pointer"
                            onClick={() => onSelect(entry)}
                        >
                            {/* Poster Image */}
                            <div className="relative flex-1 overflow-hidden">
                                {(entry.thumb || entry.parentThumb) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={`/api/image?path=${encodeURIComponent(entry.parentThumb || entry.thumb || "")}&serverId=${entry.serverId}`}
                                        alt={entry.title}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-slate-800">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src="/images/Plexmo_icon.png"
                                            alt="No Poster"
                                            className="h-12 w-12 object-contain opacity-20 grayscale"
                                        />
                                    </div>
                                )}

                                {/* Diagonal Ribbon for Date */}
                                <div className="absolute top-[16px] -right-[28px] w-[100px] rotate-45 bg-amber-500 py-[2px] text-center text-[9px] font-bold text-black shadow-sm z-10">
                                    {formatDate(entry.stopTime)}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="bg-black/80 backdrop-blur-md p-3 border-t border-white/10 shrink-0 h-[50px] flex flex-col justify-center">
                                <h3 className="line-clamp-1 text-xs font-bold text-white leading-tight mb-0.5" title={entry.title}>
                                    {entry.title}
                                </h3>
                                {entry.subtitle && (
                                    <p className="line-clamp-1 text-[10px] text-white/60 font-medium" title={entry.subtitle}>
                                        {entry.subtitle}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                    {entries.length === 0 && (
                        <div className="w-full flex h-40 items-center justify-center text-white/30">
                            No history yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
