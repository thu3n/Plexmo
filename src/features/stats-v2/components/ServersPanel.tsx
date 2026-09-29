"use client";

import clsx from "clsx";
import { Skeleton } from "@/components/Skeleton";
import { getServerColor } from "@/lib/serverColors";
import type { PublicServer } from "@/lib/servers";
import type { ServerHealth, ServerHealthState } from "@/lib/server-health";
import type { ServerResources } from "@/lib/server-resources";
import type { ServerPlays } from "@/features/stats/hooks/useStatsData";
import { EmptyRow, Panel, ViewAll } from "./Panel";
import { formatCount, formatHours, percentOf } from "../lib/overview-math";
import { useHomeLight, useServerLive, useServers } from "../hooks/useStatsV2";
import { INSET_CLASS } from "../lib/theme";

const HEALTH_LABEL: Record<ServerHealthState, string> = {
    online: "Online",
    unauthorized: "Token rejected",
    unreachable: "Offline",
    disabled: "Paused",
};

// Plex's API has no GPU utilisation; the Plex process's own CPU share is the
// closest honest signal for "how hard is Plex working".
const LOAD_METERS = [
    { key: "hostCpu", label: "CPU" },
    { key: "hostMemory", label: "RAM" },
    { key: "processCpu", label: "Plex" },
] as const;

function LoadMeter({ label, value }: { label: string; value: number | null | undefined }) {
    return (
        <div>
            <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-white/55">{label}</span>
                <span className={clsx("tabular-nums", value == null ? "text-white/35" : "text-white")}>
                    {value == null ? "—" : `${value}%`}
                </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${value ?? 0}%` }} />
            </div>
        </div>
    );
}

function ServerTile({
    server,
    stats,
    share,
    live,
    load,
}: {
    server: PublicServer;
    stats: ServerPlays | undefined;
    share: number;
    live: ServerHealth | undefined;
    load: ServerResources | undefined;
}) {
    // Viewers don't get the owner-only live probe; fall back to the cron's last view.
    const state: ServerHealthState =
        live?.state ?? (server.disabled ? "disabled" : server.status === "unreachable" ? "unreachable" : "online");
    const color = getServerColor(server.id, server.color);

    return (
        <div className={`${INSET_CLASS} p-4`}>
            <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white" title={server.name}>{server.name}</span>
                <span
                    title={live?.message ?? undefined}
                    className={clsx(
                        "shrink-0 rounded px-1.5 py-0.5 text-[11px]",
                        state === "online" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
                    )}
                >
                    {HEALTH_LABEL[state]}
                    {state === "online" && live?.latencyMs != null && ` · ${live.latencyMs} ms`}
                </span>
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
                <div>
                    <p className="text-xl font-semibold tabular-nums text-white">{share}%</p>
                    <p className="text-[11px] text-white/55">of plays</p>
                </div>
                <div className="text-right text-xs tabular-nums text-white/75">
                    <p>{formatCount(stats?.plays ?? 0)} plays</p>
                    <p>{formatHours(stats?.duration ?? 0)} watched</p>
                </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(share, 1)}%`, backgroundColor: color }} />
            </div>

            {/* Load only exists for a live, owner-visible server — three rows of dashes
                for a paused or offline one read as broken, so they're left out. */}
            {LOAD_METERS.some((m) => load?.[m.key] != null) && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                    {LOAD_METERS.map((m) => <LoadMeter key={m.key} label={m.label} value={load?.[m.key]} />)}
                </div>
            )}
        </div>
    );
}

export function ServersPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const home = useHomeLight(days, serverId);
    const servers = useServers().filter((s) => !s.archived);
    const { health, resources } = useServerLive();
    const rows = home?.playsPerServer;
    const total = rows?.reduce((sum, r) => sum + r.plays, 0) ?? 0;
    // Busiest first; servers without plays in the window still show their status.
    const ordered = [...servers].sort(
        (a, b) => (rows?.find((r) => r.serverId === b.id)?.plays ?? 0) - (rows?.find((r) => r.serverId === a.id)?.plays ?? 0),
    );

    return (
        <Panel id="servers" title="Servers" action={<ViewAll href="/settings/servers" label="Manage" />}>
            {!rows ? (
                <Skeleton className="h-[150px] rounded-lg" />
            ) : ordered.length === 0 ? (
                <EmptyRow />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {ordered.map((server) => {
                        const stats = rows.find((r) => r.serverId === server.id);
                        return (
                            <ServerTile
                                key={server.id}
                                server={server}
                                stats={stats}
                                share={percentOf(stats?.plays ?? 0, total)}
                                live={health?.find((h) => h.serverId === server.id)}
                                load={resources?.find((r) => r.serverId === server.id)}
                            />
                        );
                    })}
                </div>
            )}
        </Panel>
    );
}
