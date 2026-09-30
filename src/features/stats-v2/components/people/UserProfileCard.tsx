"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/Skeleton";
import { avatarSrc } from "@/lib/avatar";
import type { NamedCount, UserProfile } from "@/lib/stats/user-insights-profile";
import { EmptyRow } from "../Panel";
import { formatCount, formatHours, formatShare, percentOf } from "../../lib/overview-math";
import { INSET_CLASS } from "../../lib/theme";
import { formatHour, peakHour, userHref } from "./people-format";

/** Axis ticks under the hour bars: midnight, 6 AM, noon, 6 PM. */
const HOUR_TICKS = [0, 6, 12, 18];
const PERCENT = 100;

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className={`${INSET_CLASS} p-3`}>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-white/45">{title}</p>
            {children}
        </div>
    );
}

function HourBars({ hours }: { hours: number[] }) {
    const max = Math.max(...hours, 1);
    const peak = peakHour(hours);
    return (
        <>
            <div className="flex h-16 items-end gap-[2px]" aria-hidden>
                {hours.map((count, hour) => (
                    <div
                        key={hour}
                        title={`${formatHour(hour)}: ${formatCount(count)}`}
                        className={hour === peak ? "flex-1 rounded-t-sm bg-amber-400" : "flex-1 rounded-t-sm bg-amber-400/35"}
                        style={{ height: `${Math.max(3, (count / max) * PERCENT)}%` }}
                    />
                ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-white/40">
                {HOUR_TICKS.map((h) => <span key={h}>{formatHour(h)}</span>)}
            </div>
            <p className="mt-2 text-xs text-white/70">
                {peak === null ? "No plays" : `Peak around ${formatHour(peak)}`}
            </p>
        </>
    );
}

function Meter({ value, label }: { value: number; label: string }) {
    return (
        <>
            <p className="text-lg font-semibold tabular-nums text-white">{label}</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-amber-400/80" style={{ width: `${Math.min(PERCENT, value)}%` }} />
            </div>
        </>
    );
}

function Chips({ items, empty }: { items: NamedCount[]; empty: string }) {
    if (items.length === 0) return <p className="text-xs text-white/40">{empty}</p>;
    return (
        <ul className="flex flex-wrap gap-1.5">
            {items.map((item) => (
                <li key={item.name} className="rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">
                    {item.name} <span className="tabular-nums text-white/45">{formatCount(item.plays)}</span>
                </li>
            ))}
        </ul>
    );
}

/**
 * Presentational viewing profile for one user. Reusable anywhere a
 * `UserProfile` is at hand (stats page picker, user detail page).
 * `undefined` renders a skeleton.
 */
export function UserProfileCard({ profile }: { profile: UserProfile | undefined }) {
    if (!profile) return <Skeleton className="h-72 rounded-xl" />;
    const genres = profile.topGenres.map((g) => ({ name: g.genre, plays: g.plays }));

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarSrc(profile.thumb, profile.user)} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                <div className="min-w-0">
                    <Link href={userHref(profile.user)} className="block truncate text-sm font-semibold text-white hover:text-amber-300">
                        {profile.user}
                    </Link>
                    <p className="text-xs text-white/55">
                        {formatCount(profile.plays)} plays · {formatHours(profile.seconds)} watched
                    </p>
                </div>
            </div>
            {profile.plays === 0 ? (
                <EmptyRow text="No plays in this period" />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Section title="Time of day">
                        <HourBars hours={profile.hours} />
                    </Section>
                    <div className="grid gap-3">
                        <Section title="Weekend share">
                            <Meter
                                value={percentOf(profile.weekendPlays, profile.plays)}
                                label={formatShare(profile.weekendPlays, profile.plays)}
                            />
                            <p className="mt-1.5 text-[11px] text-white/45">
                                {formatCount(profile.weekdayPlays)} weekday · {formatCount(profile.weekendPlays)} weekend
                            </p>
                        </Section>
                        <Section title="Average completion">
                            {profile.averageCompletion === null ? (
                                <p className="text-xs text-white/40">Unknown</p>
                            ) : (
                                <Meter value={profile.averageCompletion} label={`${profile.averageCompletion}%`} />
                            )}
                        </Section>
                    </div>
                    <Section title="Platforms">
                        <Chips items={profile.topPlatforms} empty="Unknown" />
                    </Section>
                    <Section title="Devices">
                        <Chips items={profile.topDevices} empty="Unknown" />
                    </Section>
                    <div className="sm:col-span-2">
                        <Section title="Top genres">
                            <Chips items={genres} empty="No genre data yet" />
                        </Section>
                    </div>
                </div>
            )}
        </div>
    );
}
