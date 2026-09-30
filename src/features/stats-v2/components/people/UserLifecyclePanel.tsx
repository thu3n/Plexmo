"use client";

import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/Skeleton";
import { avatarSrc } from "@/lib/avatar";
import { EmptyRow, Panel, Tabs, type TabOption } from "../Panel";
import { RankedList } from "../RankedList";
import { formatBucketLabel, formatCount } from "../../lib/overview-math";
import { ACCENT, DECISION_COLORS, TOOLTIP_STYLE, TRACK } from "../../lib/theme";
import { useUserLifecycle } from "../../hooks/people";
import { formatDays, formatShortDate, userHref } from "./people-format";

type Scope = { days: number; serverId: string | null };
type View = "growth" | "dormant";

const VIEWS: TabOption<View>[] = [
    { key: "growth", label: "Growth" },
    { key: "dormant", label: "Dormant" },
];

const AXIS = "rgba(255,255,255,0.55)";
/** Returning users: the accent at reduced strength so "new" stays the headline. */
const RETURNING_COLOR = "rgba(251,191,36,0.38)";
/** Dormant reads as a warning — same rose as the Transcode decision. */
const DORMANT_COLOR = DECISION_COLORS.transcode;
const DORMANT_COLUMNS = ["Silent", "Plays"];

/**
 * Users as a population: new vs returning actives per month with the dormant
 * pool as a line, and the current dormant list (share-removal candidates).
 * Monthly by nature — short periods show just the running month.
 */
export function UserLifecyclePanel({ days, serverId }: Scope) {
    const [view, setView] = useState<View>("growth");
    const data = useUserLifecycle(days, serverId);

    // Memoized so Recharts doesn't restart its entry animation on unrelated renders.
    const points = useMemo(
        () => data?.months.map((m) => ({ ...m, label: formatBucketLabel(m.month) })),
        [data],
    );

    const dormantRows = data?.dormantUsers.map((u) => ({
        key: u.accountId,
        label: u.user,
        sub: `Last played ${formatShortDate(u.lastPlayed)}`,
        href: userHref(u.user),
        // eslint-disable-next-line @next/next/no-img-element
        icon: <img src={avatarSrc(u.thumb, u.user)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />,
        values: [formatDays(u.daysSinceLastPlay), formatCount(u.plays)],
        magnitude: u.daysSinceLastPlay,
    }));

    return (
        <Panel
            id="user-lifecycle"
            title="User lifecycle"
            action={<Tabs options={VIEWS} value={view} onChange={setView} size="sm" />}
            className="flex flex-col"
        >
            {view === "growth" ? (
                <div className="relative min-h-[240px] flex-1">
                    {!points ? (
                        <Skeleton className="absolute inset-0 rounded-lg" />
                    ) : points.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center"><EmptyRow /></div>
                    ) : (
                        <div className="absolute inset-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid stroke={TRACK} vertical={false} />
                                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
                                    <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: TRACK }} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: AXIS }} />
                                    <Bar dataKey="new" name="New" stackId="active" fill={ACCENT} />
                                    <Bar dataKey="returning" name="Returning" stackId="active" fill={RETURNING_COLOR} radius={[3, 3, 0, 0]} />
                                    <Line dataKey="dormant" name={`Dormant (${data?.dormantDays}d)`} type="monotone" stroke={DORMANT_COLOR} strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1">
                    {data && (
                        <p className="mb-3 text-xs text-white/55">
                            {formatCount(data.dormantTotal)} users with no plays in {data.dormantDays} days — candidates for removing shares.
                        </p>
                    )}
                    <RankedList
                        columns={DORMANT_COLUMNS}
                        rows={dormantRows}
                        emptyText={`Everyone has played within ${data?.dormantDays ?? ""} days`}
                    />
                </div>
            )}
        </Panel>
    );
}
