"use client";

import { useState } from "react";
import { avatarSrc } from "@/lib/avatar";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "./Panel";
import { InitialBadge, RankedList } from "./RankedList";
import { formatCount, formatHours } from "../lib/overview-math";
import { useDevices, useHomeLight } from "../hooks/useStatsV2";

type Scope = { days: number; serverId: string | null };

const COLUMNS = ["Plays", "Watched"];

function useExpanded() {
    const [expanded, setExpanded] = useState(false);
    return {
        limit: expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT,
        toggle: <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />,
    };
}

export function TopUsersPanel({ days, serverId }: Scope) {
    const { limit, toggle } = useExpanded();
    const home = useHomeLight(days, serverId, limit);
    return (
        <Panel id="users" title="Top users" className="flex flex-col">
            <div className="flex-1">
                <RankedList
                    columns={COLUMNS}
                    skeletonRows={limit}
                    rows={home?.topUsers.map((u) => ({
                        key: u.accountId,
                        label: u.user,
                        href: `/settings/users/${encodeURIComponent(u.user)}?from=statistics`,
                        // eslint-disable-next-line @next/next/no-img-element
                        icon: <img src={avatarSrc(u.thumb, u.user)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />,
                        values: [formatCount(u.plays), formatHours(u.duration)],
                        magnitude: u.plays,
                    }))}
                />
            </div>
            <div className="mt-3 text-right">{toggle}</div>
        </Panel>
    );
}

type ClientView = "platforms" | "devices";

const CLIENT_VIEWS: TabOption<ClientView>[] = [
    { key: "platforms", label: "Platforms" },
    { key: "devices", label: "Devices" },
];

/**
 * Platforms and devices answer the same question ("what do people watch
 * on?") at two granularities — one panel with a toggle instead of two
 * near-duplicate lists (Chrome, Android, Apple TV appeared in both).
 */
export function ClientsPanel({ days, serverId }: Scope) {
    const [view, setView] = useState<ClientView>("platforms");
    const { limit, toggle } = useExpanded();
    const home = useHomeLight(days, serverId, limit);
    // The device graph always returns the top 25; expanding just reveals more rows.
    const devices = useDevices(days, serverId)?.slice(0, limit);

    const rows =
        view === "platforms"
            ? home?.topPlatforms.map((p) => ({
                  key: p.platform,
                  label: p.platform,
                  icon: <InitialBadge label={p.platform} />,
                  values: [formatCount(p.plays), formatHours(p.duration)],
                  magnitude: p.plays,
              }))
            : devices?.map((d) => ({
                  key: d.bucket,
                  label: d.bucket,
                  icon: <InitialBadge label={d.bucket} />,
                  values: [formatCount(d.total), formatHours(d.duration ?? 0)],
                  magnitude: d.total,
              }));

    return (
        <Panel
            id="devices"
            title="Clients"
            action={<Tabs options={CLIENT_VIEWS} value={view} onChange={setView} size="sm" />}
            className="flex flex-col"
        >
            <div className="flex-1">
                <RankedList columns={COLUMNS} skeletonRows={limit} rows={rows} />
            </div>
            <div className="mt-3 text-right">{toggle}</div>
        </Panel>
    );
}
