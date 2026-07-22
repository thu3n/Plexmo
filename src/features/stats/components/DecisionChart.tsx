"use client";

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { DECISION_COLORS, DECISION_LABELS, DECISION_ORDER, CHART_INK } from "../palette";
import type { GraphRow } from "../hooks/useStatsData";

type DecisionChartProps = {
    data: GraphRow[];
    /** Maps the bucket value to a display label (dates, hours, weekdays). */
    formatBucket?: (bucket: string) => string;
    height?: number;
};

const tooltipStyle = {
    backgroundColor: CHART_INK.tooltipBg,
    border: `1px solid ${CHART_INK.tooltipBorder}`,
    borderRadius: 12,
    fontSize: 12,
} as const;

/**
 * Stacked bars split by stream decision — the Tautulli "plays by period"
 * graph. Series identity is fixed by category (see palette.ts); a 2px
 * surface-colored stroke separates stacked segments.
 */
export function DecisionChart({ data, formatBucket, height = 280 }: DecisionChartProps) {
    // Only stack series that actually occur, so e.g. "unknown" doesn't clutter
    // the legend on fully backfilled databases.
    const activeKeys = DECISION_ORDER.filter((key) =>
        data.some((row) => (row[key] ?? 0) > 0)
    );

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
                <XAxis
                    dataKey="bucket"
                    tickFormatter={formatBucket}
                    tick={{ fill: CHART_INK.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    allowDecimals={false}
                    tick={{ fill: CHART_INK.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                />
                <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => (formatBucket ? formatBucket(String(label)) : label)}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                {activeKeys.length > 1 && (
                    <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, color: CHART_INK.axis }}
                    />
                )}
                {activeKeys.map((key) => (
                    <Bar
                        key={key}
                        dataKey={key}
                        name={DECISION_LABELS[key]}
                        stackId="decision"
                        fill={DECISION_COLORS[key]}
                        stroke={CHART_INK.tooltipBg}
                        strokeWidth={1}
                        maxBarSize={28}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}
