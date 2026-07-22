"use client";

import { useGraphData } from "../hooks/useStatsData";
import { DecisionChart } from "./DecisionChart";
import { DecisionShareBar } from "./DecisionShareBar";
import { Skeleton } from "@/components/Skeleton";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Above a year of data, daily buckets are noise — switch to monthly. */
const MONTHLY_THRESHOLD_DAYS = 365;

const formatDay = (bucket: string) => {
    const [, month, day] = bucket.split("-");
    return `${day}/${month}`;
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl glass-panel border border-white/5 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/40 mb-4">{title}</h3>
            {children}
        </div>
    );
}

/** The four charts of the merged statistics page, driven by the page-level period. */
export function ChartsSection({ days, serverId }: { days: number; serverId: string | null }) {
    const usesMonthly = days > MONTHLY_THRESHOLD_DAYS;
    const { data: byDay, isLoading: byDayLoading } = useGraphData(
        usesMonthly ? "plays_by_month" : "plays_by_day",
        days,
        serverId,
    );
    const { data: byHour, isLoading: byHourLoading } = useGraphData("plays_by_hour", days, serverId);
    const { data: byDow, isLoading: byDowLoading } = useGraphData("plays_by_dayofweek", days, serverId);
    const { data: share, isLoading: shareLoading } = useGraphData("transcode_share", days, serverId);

    return (
        <section className="space-y-6">
            <Panel title={usesMonthly ? "Plays per month" : "Plays per day"}>
                {byDayLoading && !byDay ? (
                    <Skeleton className="h-[280px]" />
                ) : (
                    <DecisionChart data={byDay?.data ?? []} formatBucket={usesMonthly ? undefined : formatDay} />
                )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Plays by hour of day">
                    {byHourLoading && !byHour ? (
                        <Skeleton className="h-[220px]" />
                    ) : (
                        <DecisionChart data={byHour?.data ?? []} height={220} formatBucket={(b) => `${b}:00`} />
                    )}
                </Panel>
                <Panel title="Plays by day of week">
                    {byDowLoading && !byDow ? (
                        <Skeleton className="h-[220px]" />
                    ) : (
                        <DecisionChart
                            data={byDow?.data ?? []}
                            height={220}
                            formatBucket={(b) => WEEKDAYS[Number(b)] ?? b}
                        />
                    )}
                </Panel>
            </div>

            <Panel title="Stream decision share">
                {shareLoading && !share ? (
                    <div>
                        <Skeleton className="h-4 rounded-full" />
                        <Skeleton className="mt-3 h-4 w-64" />
                    </div>
                ) : (
                    <DecisionShareBar data={(share?.data ?? []) as { bucket: string; total: number }[]} />
                )}
            </Panel>
        </section>
    );
}
