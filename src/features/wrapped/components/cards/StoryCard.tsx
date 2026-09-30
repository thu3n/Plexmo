import clsx from "clsx";
import type { ReactNode } from "react";
import type { ThumbRef } from "@/lib/stats/media-thumbs";
import { buildThumbUrl } from "@/features/stats/lib/top-media-list";

/**
 * Each card gets its own soft glow over the shared glass panel — radial
 * gradients rather than blur filters (blur is the iOS perf trap noted in
 * src/app/page.tsx). Amber stays the data accent on every tone.
 */
const TONES = {
    amber: "bg-[radial-gradient(120%_80%_at_0%_0%,rgba(251,191,36,0.22),transparent_60%)]",
    violet: "bg-[radial-gradient(120%_80%_at_100%_0%,rgba(168,85,247,0.22),transparent_60%)]",
    rose: "bg-[radial-gradient(120%_80%_at_0%_100%,rgba(251,113,133,0.20),transparent_60%)]",
    sky: "bg-[radial-gradient(120%_80%_at_100%_100%,rgba(56,189,248,0.18),transparent_60%)]",
    emerald: "bg-[radial-gradient(120%_80%_at_50%_0%,rgba(52,211,153,0.18),transparent_60%)]",
} as const;

export type StoryTone = keyof typeof TONES;

export function StoryCard({
    eyebrow,
    tone,
    children,
    className,
}: {
    eyebrow: string;
    tone: StoryTone;
    children: ReactNode;
    className?: string;
}) {
    return (
        <article
            className={clsx(
                // The app-wide glass surface (PANEL_CLASS minus its rounded-2xl, which would fight rounded-3xl).
                "glass-panel relative flex h-[min(62dvh,640px)] min-h-[420px] w-[calc(100vw-2rem)] max-w-[380px] shrink-0 flex-col overflow-hidden rounded-3xl p-6 sm:w-[360px]",
                className,
            )}
        >
            <div className={clsx("pointer-events-none absolute inset-0", TONES[tone])} aria-hidden />
            <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">{eyebrow}</p>
            <div className="relative mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
        </article>
    );
}

/** Oversized stat number — the headline of most cards. */
export function BigNumber({ value, unit }: { value: string; unit?: string }) {
    return (
        <p className="leading-none">
            <span className="text-6xl font-bold tabular-nums tracking-tight text-amber-300 sm:text-7xl">{value}</span>
            {unit && <span className="ml-2 text-lg font-medium text-white/70">{unit}</span>}
        </p>
    );
}

const POSTER_SIZES = {
    lg: { box: "h-40 w-[6.75rem]", px: { w: 270, h: 405 } },
    sm: { box: "h-12 w-8", px: { w: 90, h: 135 } },
} as const;

export function Poster({ thumb, size }: { thumb: ThumbRef | null; size: keyof typeof POSTER_SIZES }) {
    const { box, px } = POSTER_SIZES[size];
    const src = buildThumbUrl(thumb, px);
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={clsx(box, "shrink-0 rounded-lg bg-slate-800 object-cover shadow-lg shadow-black/40")} />
    ) : (
        <div className={clsx(box, "shrink-0 rounded-lg bg-white/5")} />
    );
}

/** Tiny bar series (months, hours) with one highlighted bar. */
export function MiniBars({
    values,
    highlight,
    labels,
}: {
    /** 0..1 heights. */
    values: number[];
    highlight: number | null;
    labels?: { index: number; text: string }[];
}) {
    return (
        <div>
            <div className="flex h-20 items-end gap-[3px]">
                {values.map((v, i) => (
                    <div
                        key={i}
                        className={clsx("flex-1 rounded-sm", i === highlight ? "bg-amber-400" : "bg-white/15")}
                        style={{ height: `${Math.max(v * 100, 4)}%` }}
                    />
                ))}
            </div>
            {labels && (
                <div className="relative mt-1.5 h-3 text-[10px] text-white/40">
                    {labels.map((l) => (
                        <span key={l.index} className="absolute -translate-x-1/2" style={{ left: `${((l.index + 0.5) / values.length) * 100}%` }}>
                            {l.text}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
