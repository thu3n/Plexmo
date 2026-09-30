"use client";

import Link from "next/link";
import { buildThumbUrl, POSTER_THUMB_HEIGHT, POSTER_THUMB_WIDTH } from "@/features/stats/lib/top-media-list";
import { SkeletonRows } from "@/components/Skeleton";
import { EmptyRow, Panel } from "../Panel";
import { formatCount } from "../../lib/overview-math";
import { titleHref } from "../../lib/explore-math";
import { useAlsoWatched } from "../../hooks/explore";

const THUMB_SIZE = { w: POSTER_THUMB_WIDTH, h: POSTER_THUMB_HEIGHT };
const SKELETON_ROWS = 2;

/** Co-occurrence: what this title's audience also played, ranked by shared viewers. */
export function AlsoWatchedPanel({ mediaId, days, serverId }: { mediaId: number; days: number; serverId: string | null }) {
    const items = useAlsoWatched(mediaId, days, serverId);

    return (
        <Panel id="also-watched" title={serverId ? "Also watched on this server" : "Also watched"}>
            <p className="-mt-2 mb-3 text-[11px] text-white/45">People who watched this also watched</p>
            {!items ? (
                <SkeletonRows count={SKELETON_ROWS} rowClassName="h-24 rounded-lg" />
            ) : items.length === 0 ? (
                <EmptyRow text="Not enough shared viewers yet" />
            ) : (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12">
                    {items.map((item) => {
                        const src = buildThumbUrl(item.thumb, THUMB_SIZE);
                        return (
                            <li key={item.mediaId} className="min-w-0">
                                <Link href={titleHref(item.mediaId)} className="group block">
                                    {src ? (
                                        // NEVER loading="lazy" — same rule as the ranked-list thumbs.
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={src} alt="" className="aspect-[2/3] w-full rounded-lg bg-slate-800 object-cover ring-1 ring-white/5 transition group-hover:ring-amber-400/60" />
                                    ) : (
                                        <div className="aspect-[2/3] w-full rounded-lg bg-white/5 ring-1 ring-white/5 transition group-hover:ring-amber-400/60" />
                                    )}
                                    <p className="mt-1.5 truncate text-xs font-medium text-white group-hover:text-amber-300">{item.title}</p>
                                    <p className="truncate text-[11px] text-white/50">
                                        {formatCount(item.sharedUsers)} shared {item.sharedUsers === 1 ? "viewer" : "viewers"}
                                    </p>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}
