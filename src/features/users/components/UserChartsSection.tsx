"use client";

import { useGraphData } from "@/features/stats/hooks/useStatsData";
import { DecisionChart } from "@/features/stats/components/DecisionChart";
import { DecisionShareBar } from "@/features/stats/components/DecisionShareBar";
import { Skeleton } from "@/components/Skeleton";
import type { GraphType } from "@/lib/stats/graph-stats";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl glass-panel border border-white/5 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/40 mb-4">{title}</h3>
            {children}
        </div>
    );
}

const formatDay = (bucket: string) => {
    const [, month, day] = bucket.split("-");
    return `${day}/${month}`;
};

const formatHour = (bucket: string) => `${bucket}:00`;

/**
 * Per-user activity charts — the same stats layer as /statistics, scoped to
 * one identity. The period is owned by the page (the stat chips ARE the
 * selector). A rolling 24h window straddles midnight, so days=1 uses hour
 * buckets as the main chart; beyond a year daily bars are unreadable, so it
 * switches to monthly buckets (same rule as the statistics page).
 */
export function UserChartsSection({ accountId, days }: { accountId: string; days: number }) {
    const usesHourly = days === 1;
    const usesMonthly = days > 365;
    const mainType: GraphType = usesHourly ? "plays_by_hour" : usesMonthly ? "plays_by_month" : "plays_by_day";
    const mainTitle = usesHourly ? "Plays by hour" : usesMonthly ? "Plays per month" : "Plays per day";

    const { data: main, isLoading: mainLoading } = useGraphData(mainType, days, null, accountId);
    // Identical SWR key as `main` when usesHourly — SWR dedupes to one request.
    const { data: byHour, isLoading: byHourLoading } = useGraphData("plays_by_hour", days, null, accountId);
    const { data: share, isLoading: shareLoading } = useGraphData("transcode_share", days, null, accountId);

    return (
        <section>
            <div className="grid gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <Panel title={mainTitle}>
                        {mainLoading && !main ? (
                            <Skeleton className="h-[280px]" />
                        ) : (
                            <DecisionChart
                                data={main?.data ?? []}
                                formatBucket={usesHourly ? formatHour : usesMonthly ? undefined : formatDay}
                            />
                        )}
                    </Panel>
                </div>
                <div className="space-y-6">
                    <Panel title="Stream decisions">
                        {shareLoading && !share ? (
                            <div>
                                <Skeleton className="h-4 rounded-full" />
                                <Skeleton className="mt-3 h-4 w-48" />
                            </div>
                        ) : (
                            <DecisionShareBar data={(share?.data ?? []) as { bucket: string; total: number }[]} />
                        )}
                    </Panel>
                    {/* At 24h the main chart IS the hour chart — no duplicate. */}
                    {!usesHourly && (
                        <Panel title="Plays by hour">
                            {byHourLoading && !byHour ? (
                                <Skeleton className="h-[180px]" />
                            ) : (
                                <DecisionChart data={byHour?.data ?? []} height={180} formatBucket={formatHour} />
                            )}
                        </Panel>
                    )}
                </div>
            </div>
        </section>
    );
}
