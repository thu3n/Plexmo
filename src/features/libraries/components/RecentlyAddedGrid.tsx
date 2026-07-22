"use client";

import { Skeleton } from "@/components/Skeleton";
import { ScrollStripArrows } from "@/components/ScrollStripArrows";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { edgeMaskClass, useScrollEdges } from "@/lib/use-scroll-edges";
import type { RecentItem } from "../types";

const SKELETON_CARD_COUNT = 10;

/**
 * Poster-forward recently-added row — the 10 newest unique titles in one
 * horizontally scrolling strip. Thumbs render through the /api/image proxy
 * (token appended server-side); items synced before the thumb column existed
 * fall back to the dimmed app icon until the next library sync.
 */
export function RecentlyAddedGrid({ items, isLoading }: { items: RecentItem[]; isLoading: boolean }) {
    const { ref, handlers } = useDragScroll<HTMLDivElement>();
    const edges = useScrollEdges(ref, [items, isLoading]);
    if (!isLoading && items.length === 0) return null;

    return (
        <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">Recently added</h2>
            <div className="relative">
                <ScrollStripArrows scrollRef={ref} edges={edges} />
                <div
                    ref={ref}
                    {...handlers}
                    className={`flex gap-4 overflow-x-auto pb-4 no-scrollbar w-full select-none cursor-grab active:cursor-grabbing ${edgeMaskClass(edges)}`}
                >
                    {isLoading
                        ? Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                              <Skeleton key={i} className="aspect-[2/3] min-w-[160px] w-[160px] shrink-0 rounded-xl" />
                          ))
                        : items.map((item) => <PosterCard key={`${item.serverId}:${item.ratingKey}`} item={item} />)}
                </div>
            </div>
        </section>
    );
}

function PosterCard({ item }: { item: RecentItem }) {
    return (
        <div className="group relative aspect-[2/3] min-w-[160px] w-[160px] shrink-0 overflow-hidden rounded-xl glass-panel border border-white/5">
            {item.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`/api/image?path=${encodeURIComponent(item.thumb)}&serverId=${item.serverId}`}
                    alt={item.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/images/Plexmo_icon.png"
                        alt="No Poster"
                        className="h-12 w-12 object-contain opacity-20 grayscale"
                    />
                </div>
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-2">
                <p className="truncate text-xs font-medium text-white" title={item.title}>
                    {item.title}
                    {item.year ? <span className="text-white/50"> ({item.year})</span> : null}
                </p>
                <p className="text-[10px] text-white/40">{new Date(item.addedAt).toLocaleDateString()}</p>
            </div>
        </div>
    );
}
