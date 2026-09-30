"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/Skeleton";
import { EmptyRow, Panel } from "../Panel";
import { formatBucketLabel } from "../../lib/overview-math";
import { ACCENT, TOOLTIP_STYLE, TRACK } from "../../lib/theme";
import { useWanLoad } from "../../hooks/quality";
import { UploadCapacityEditor } from "./UploadCapacityEditor";

const AXIS = "rgba(255,255,255,0.55)";
const CAPACITY_STROKE = "rgba(255,255,255,0.5)";
const PERCENT = 100;

/** Hourly buckets are "YYYY-MM-DD HH:00"; day/month buckets reuse the shared formatter. */
const formatWanBucket = (bucket: string): string => {
    const [day, time] = bucket.split(" ");
    return time ? `${formatBucketLabel(day)} ${time}` : formatBucketLabel(day);
};

/** Peak concurrent remote (upload) bandwidth over time against the configured upload capacity. */
export function WanLoadPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const { data, mutate } = useWanLoad(days, serverId);
    const capacity = data?.capacityMbps ?? null;
    const points = useMemo(() => data?.points, [data]);
    const peakShare = capacity && data ? Math.round((data.peakMbps / capacity) * PERCENT) : null;

    return (
        <Panel
            id="quality-wan"
            title="Remote upload load"
            action={data && <UploadCapacityEditor capacityMbps={capacity} onSaved={() => void mutate()} />}
            className="flex flex-col"
        >
            {data && data.peakMbps > 0 && (
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-2xl font-semibold tabular-nums text-white">{data.peakMbps} Mbps</p>
                    <p className="text-xs text-white/55">
                        peak {data.peakBucket && `· ${formatWanBucket(data.peakBucket)}`}
                        {peakShare !== null && (
                            <span className={peakShare >= PERCENT ? "text-rose-400" : undefined}>
                                {` · ${peakShare}% of upload`}
                            </span>
                        )}
                    </p>
                </div>
            )}
            <div className="relative min-h-[200px] flex-1">
                {!points ? (
                    <Skeleton className="absolute inset-0 rounded-lg" />
                ) : points.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center"><EmptyRow text="No remote plays in this period" /></div>
                ) : (
                    <div className="absolute inset-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="v2-wan-fill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke={TRACK} vertical={false} />
                                <XAxis
                                    dataKey="bucket"
                                    tickFormatter={formatWanBucket}
                                    tick={{ fill: AXIS, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    minTickGap={28}
                                />
                                <YAxis
                                    tick={{ fill: AXIS, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    // Keep the capacity line in view even when peaks sit far below it.
                                    domain={[0, (max: number) => Math.max(max, capacity ?? 0)]}
                                />
                                <Tooltip
                                    contentStyle={{ ...TOOLTIP_STYLE, fontSize: 12 }}
                                    labelFormatter={(label) => formatWanBucket(String(label))}
                                    formatter={(value, _name, item) => [
                                        `${value} Mbps · ${(item.payload as { peakStreams: number }).peakStreams} streams`,
                                        "Peak",
                                    ]}
                                    cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1 }}
                                />
                                {capacity !== null && (
                                    <ReferenceLine
                                        y={capacity}
                                        stroke={CAPACITY_STROKE}
                                        strokeDasharray="4 4"
                                        label={{ value: "Upload", position: "insideTopRight", fill: AXIS, fontSize: 11 }}
                                    />
                                )}
                                <Area
                                    type="stepAfter"
                                    dataKey="peakMbps"
                                    stroke={ACCENT}
                                    strokeWidth={2}
                                    fill="url(#v2-wan-fill)"
                                    isAnimationActive={false}
                                    activeDot={{ r: 4, stroke: "#000", strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </Panel>
    );
}
