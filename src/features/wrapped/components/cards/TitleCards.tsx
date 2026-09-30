import type { WrappedData, WrappedTitle } from "@/lib/stats/wrapped";
import { dayLabel, formatDuration } from "../../lib/wrapped-format";
import { Poster, StoryCard, type StoryTone } from "./StoryCard";

const plays = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "play" : "plays"}`;

export function TopTitlesCard({
    eyebrow,
    tone,
    titles,
}: {
    eyebrow: string;
    tone: StoryTone;
    titles: WrappedTitle[];
}) {
    const [first, ...rest] = titles;
    if (!first) return null;
    return (
        <StoryCard eyebrow={eyebrow} tone={tone}>
            <div className="flex items-end gap-4">
                <Poster thumb={first.thumb} size="lg" />
                <div className="min-w-0 pb-1">
                    <p className="text-xs font-semibold text-amber-300">#1</p>
                    <p className="line-clamp-3 text-2xl font-bold leading-tight text-white">{first.title}</p>
                    <p className="mt-1 text-sm text-white/60">
                        {plays(first.plays)} · {formatDuration(first.seconds)}
                    </p>
                </div>
            </div>
            <ol className="mt-auto space-y-2 pt-4">
                {rest.map((t, i) => (
                    <li key={t.mediaId} className="flex items-center gap-3">
                        <span className="w-4 text-center text-xs tabular-nums text-white/45">{i + 2}</span>
                        <Poster thumb={t.thumb} size="sm" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-white">{t.title}</p>
                            <p className="text-[11px] text-white/50">{plays(t.plays)}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </StoryCard>
    );
}

export function BingeCard({ binge }: { binge: NonNullable<WrappedData["longestBinge"]> }) {
    const date = new Date(binge.startedAt);
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    return (
        <StoryCard eyebrow="Longest binge" tone="rose">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Poster thumb={binge.thumb} size="lg" />
                <p className="mt-6 text-6xl font-bold tabular-nums text-amber-300">{binge.episodes}</p>
                <p className="mt-1 text-sm text-white/70">episodes in a row of</p>
                <p className="mt-1 line-clamp-2 text-2xl font-bold text-white">{binge.showTitle}</p>
                <p className="mt-4 text-sm text-white/55">
                    {dayLabel(dateKey)} · {formatDuration(binge.seconds)}
                </p>
            </div>
        </StoryCard>
    );
}
