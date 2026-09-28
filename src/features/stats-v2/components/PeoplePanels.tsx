"use client";

import { avatarSrc } from "@/lib/avatar";
import { Panel, ViewAll } from "./Panel";
import { InitialBadge, RankTable } from "./RankTable";
import { formatCount, formatHours } from "../lib/overview-math";
import { useDevices, useHomeLight } from "../hooks/useStatsV2";

type Scope = { days: number; serverId: string | null };

export function TopUsersPanel({ days, serverId }: Scope) {
    const home = useHomeLight(days, serverId);
    return (
        <Panel id="users" title="Top users" action={<ViewAll href="/settings/users" />}>
            <RankTable
                columns={["User", "Plays", "Watch time"]}
                rows={home?.topUsers.map((u) => ({
                    key: u.accountId,
                    label: u.user,
                    // eslint-disable-next-line @next/next/no-img-element
                    icon: <img src={avatarSrc(u.thumb, u.user)} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />,
                    cells: [formatCount(u.plays), formatHours(u.duration)],
                }))}
            />
        </Panel>
    );
}

export function TopPlatformsPanel({ days, serverId }: Scope) {
    const home = useHomeLight(days, serverId);
    return (
        <Panel title="Top platforms" action={<ViewAll href="/statistics" />}>
            <RankTable
                columns={["Platform", "Plays", "Watch time"]}
                dense
                rows={home?.topPlatforms.map((p) => ({
                    key: p.platform,
                    label: p.platform,
                    icon: <InitialBadge label={p.platform} />,
                    cells: [formatCount(p.plays), formatHours(p.duration)],
                }))}
            />
        </Panel>
    );
}

export function DevicesPanel({ days, serverId }: Scope) {
    const devices = useDevices(days, serverId);
    return (
        <Panel id="devices" title="Devices" action={<ViewAll href="/statistics" />} className="!p-3">
            <RankTable
                columns={["Device", "Plays", "Watch time"]}
                ranked={false}
                dense
                rows={devices?.map((d) => ({
                    key: d.bucket,
                    label: d.bucket,
                    icon: <InitialBadge label={d.bucket} />,
                    cells: [formatCount(d.total), formatHours(d.duration ?? 0)],
                }))}
            />
        </Panel>
    );
}
