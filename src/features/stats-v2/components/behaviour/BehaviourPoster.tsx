"use client";

import type { ThumbRef } from "@/lib/stats/media-thumbs";
import { buildThumbUrl, POSTER_THUMB_HEIGHT, POSTER_THUMB_WIDTH } from "@/features/stats/lib/top-media-list";

const THUMB_SIZE = { w: POSTER_THUMB_WIDTH, h: POSTER_THUMB_HEIGHT };

/** Same poster box as the Trending/Top lists so behaviour rows line up with them. */
export function BehaviourPoster({ thumb }: { thumb: ThumbRef | null }) {
    const src = buildThumbUrl(thumb, THUMB_SIZE);
    if (!src) return <div className="h-12 w-8 shrink-0 rounded bg-white/5" />;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-12 w-8 shrink-0 rounded bg-slate-800 object-cover" />;
}
