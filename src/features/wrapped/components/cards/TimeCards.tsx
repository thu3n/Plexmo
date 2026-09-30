import type { WrappedData } from "@/lib/stats/wrapped";
import {
    dayLabel,
    formatDuration,
    formatWrappedHours,
    hourLabel,
    hourPersona,
    hoursInDays,
    monthName,
    normalize,
    rankLabel,
    shortMonth,
} from "../../lib/wrapped-format";
import { BigNumber, MiniBars, StoryCard } from "./StoryCard";

const HOUR_TICKS = [0, 6, 12, 18];
const MONTH_TICKS = [0, 3, 6, 9];

export function IntroCard({ data }: { data: WrappedData }) {
    const rank = rankLabel(data.rank);
    const empty = data.totals.seconds <= 0;
    return (
        <StoryCard eyebrow="Plexmo Wrapped" tone="amber">
            <div className="flex flex-1 flex-col justify-end">
                <p className="text-7xl font-black tracking-tighter text-white sm:text-8xl">{data.year}</p>
                <p className="mt-3 text-xl font-semibold text-white/90">{data.userName}&apos;s year on Plex</p>
                <p className="mt-2 text-sm text-white/60">
                    {empty
                        ? `Nothing played in ${data.year} yet.`
                        : `${data.totals.plays.toLocaleString("en-US")} plays across ${data.totals.activeDays} days, ${data.totals.titles.toLocaleString("en-US")} different titles.`}
                </p>
                {rank && (
                    <span className="mt-5 inline-flex w-fit rounded-full bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200 ring-1 ring-amber-400/25">
                        {rank} by watch time
                    </span>
                )}
                {!empty && <p className="mt-8 text-xs text-white/40">Swipe to see your year →</p>}
            </div>
        </StoryCard>
    );
}

export function TimeCard({ data }: { data: WrappedData }) {
    const { value, unit } = formatWrappedHours(data.totals.seconds);
    const days = hoursInDays(data.totals.seconds);
    const peak = data.busiestMonth;
    return (
        <StoryCard eyebrow="Time well spent" tone="violet">
            <p className="text-sm text-white/60">You watched</p>
            <div className="mt-2">
                <BigNumber value={value} unit={unit} />
            </div>
            {days && <p className="mt-3 text-sm text-white/70">That&apos;s {days} of nonstop watching.</p>}
            <div className="mt-auto">
                {peak && (
                    <p className="mb-3 text-sm text-white/80">
                        <span className="font-semibold text-amber-300">{monthName(peak.month)}</span> was your biggest month
                        ({formatDuration(peak.seconds)}).
                    </p>
                )}
                <MiniBars
                    values={normalize(data.monthlySeconds)}
                    highlight={peak ? peak.month - 1 : null}
                    labels={MONTH_TICKS.map((i) => ({ index: i, text: shortMonth(i + 1) }))}
                />
            </div>
        </StoryCard>
    );
}

export function RhythmCard({ data }: { data: WrappedData }) {
    const hour = data.favouriteHour;
    const persona = hour ? hourPersona(hour.hour) : null;
    return (
        <StoryCard eyebrow="Your rhythm" tone="sky">
            {persona && hour && (
                <>
                    <p className="text-4xl font-bold tracking-tight text-white">{persona.name}</p>
                    <p className="mt-2 text-sm text-white/65">{persona.blurb}</p>
                    <p className="mt-4 text-sm text-white/80">
                        Most plays start around <span className="font-semibold text-amber-300">{hourLabel(hour.hour)}</span>.
                    </p>
                    <div className="mt-4">
                        <MiniBars
                            values={normalize(data.hourlyPlays)}
                            highlight={hour.hour}
                            labels={HOUR_TICKS.map((i) => ({ index: i, text: hourLabel(i) }))}
                        />
                    </div>
                </>
            )}
            {data.busiestDay && (
                <div className="mt-auto rounded-2xl border border-white/5 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-wide text-white/45">Biggest day</p>
                    <p className="mt-1 text-base font-semibold text-white">{dayLabel(data.busiestDay.date)}</p>
                    <p className="text-sm text-white/60">
                        {formatDuration(data.busiestDay.seconds)} across {data.busiestDay.plays} {data.busiestDay.plays === 1 ? "play" : "plays"}
                    </p>
                </div>
            )}
        </StoryCard>
    );
}
