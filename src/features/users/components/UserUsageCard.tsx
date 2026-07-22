"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { TopList, type TopListItem } from "@/features/stats/components/TopList";
import { getPlayerIconInfo } from "@/lib/platform-icons";
import type { UserStats } from "@/lib/user_stats";

type UsageMode = "platforms" | "players";

// The API returns unbounded distinct platform/player strings — rank the top
// slice and fold the tail into one "Other" row.
const TOP_USAGE_LIMIT = 8;

function UsageIcon({ name }: { name: string }) {
    const { icon, color } = getPlayerIconInfo(name, name);
    return (
        <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow"
            style={{ backgroundColor: color }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/images/platforms/${icon}.svg`} alt={name} className="h-5 w-5 invert brightness-0" />
        </span>
    );
}

const toItems = (rows: { name: string; count: number }[]): TopListItem[] => {
    const top = rows.slice(0, TOP_USAGE_LIMIT).map((row) => ({
        key: row.name || "unknown",
        label: row.name || "Unknown",
        value: row.count,
        valueLabel: `${row.count} plays`,
        icon: <UsageIcon name={row.name} />,
    }));

    const restCount = rows.slice(TOP_USAGE_LIMIT).reduce((sum, row) => sum + row.count, 0);
    if (restCount > 0) {
        top.push({
            key: "__other",
            label: "Other",
            value: restCount,
            valueLabel: `${restCount} plays`,
            icon: (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <MoreHorizontal className="h-5 w-5 text-white/40" />
                </span>
            ),
        });
    }
    return top;
};

/**
 * Platform Usage + Player Usage woven into one card: a pill toggle switches
 * the ranked icon-bar list between the two — half the vertical space of the
 * old twin icon-grid panels.
 */
export function UserUsageCard({
    platforms,
    players,
}: {
    platforms: UserStats["platforms"];
    players: UserStats["players"];
}) {
    const [mode, setMode] = useState<UsageMode>("platforms");

    const rows =
        mode === "platforms"
            ? platforms.map((p) => ({ name: p.platform, count: p.count }))
            : (players ?? []).map((p) => ({ name: p.player, count: p.count }));

    const toggle = (
        <div className="flex items-center gap-1 rounded-full border border-white/5 bg-white/5 p-1">
            {(["platforms", "players"] as const).map((m) => (
                <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        mode === m ? "bg-white text-black" : "text-white/60 hover:text-white"
                    }`}
                >
                    {m === "platforms" ? "Platforms" : "Players"}
                </button>
            ))}
        </div>
    );

    return (
        <TopList
            title="Usage"
            emptyText="No data available."
            items={toItems(rows)}
            headerExtra={toggle}
        />
    );
}
