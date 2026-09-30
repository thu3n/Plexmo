import clsx from "clsx";
import type { WrappedData } from "@/lib/stats/wrapped";
import type { WrappedGenre } from "@/lib/stats/wrapped-genres";
import { formatDuration, normalize } from "../../lib/wrapped-format";
import { StoryCard } from "./StoryCard";

export function DevicesCard({ devices }: { devices: WrappedData["devices"] }) {
    const [top] = devices;
    const widths = normalize(devices.map((d) => d.seconds));
    return (
        <StoryCard eyebrow="Where you watched" tone="emerald">
            <p className="text-sm text-white/60">Your go-to screen</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-white">{top.name}</p>
            <ul className="mt-auto space-y-3">
                {devices.map((d, i) => (
                    <li key={d.name}>
                        <div className="flex items-baseline justify-between gap-3 text-[13px]">
                            <span className="truncate font-medium text-white">{d.name}</span>
                            <span className="shrink-0 tabular-nums text-white/55">{formatDuration(d.seconds)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
                            <div
                                className={clsx("h-full rounded-full", i === 0 ? "bg-amber-400" : "bg-white/30")}
                                style={{ width: `${Math.max(widths[i] * 100, 3)}%` }}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </StoryCard>
    );
}

const GENRE_SIZES = ["text-3xl", "text-2xl", "text-xl", "text-lg", "text-base"];

export function GenresCard({ genres }: { genres: WrappedGenre[] }) {
    return (
        <StoryCard eyebrow="Your genres" tone="violet">
            <p className="text-sm text-white/60">You kept coming back to</p>
            <div className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-2">
                {genres.map((g, i) => (
                    <span
                        key={g.genre}
                        className={clsx(
                            "rounded-full px-3 py-1 font-bold",
                            GENRE_SIZES[i] ?? "text-base",
                            i === 0 ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/25" : "bg-white/[0.05] text-white/85",
                        )}
                    >
                        {g.genre}
                    </span>
                ))}
            </div>
        </StoryCard>
    );
}
