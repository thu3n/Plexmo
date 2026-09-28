"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, Cpu, Database, MemoryStick, MonitorCog } from "lucide-react";
import { SkeletonRows } from "@/components/Skeleton";
import { getServerColor } from "@/lib/serverColors";
import type { PublicServer } from "@/lib/servers";
import type { ServerHealthState } from "@/lib/server-health";
import { EmptyRow, Panel, ViewAll } from "./Panel";
import { formatCount, formatHours, percentOf } from "../lib/overview-math";
import { useHomeLight, useServerLive, useServers } from "../hooks/useStatsV2";

const LOAD_TILES = [
    { key: "hostCpu", label: "CPU", icon: Cpu },
    { key: "hostMemory", label: "RAM", icon: MemoryStick },
    // Plex's API has no GPU utilisation; the Plex process's own CPU share is the
    // closest honest signal for "how hard is Plex working".
    { key: "processCpu", label: "Plex", icon: MonitorCog },
] as const;

const HEALTH_LABEL: Record<ServerHealthState, string> = {
    online: "Online",
    unauthorized: "Token rejected",
    unreachable: "Offline",
    disabled: "Paused",
};

function ServerStatus({ servers }: { servers: PublicServer[] }) {
    const [open, setOpen] = useState(false);
    const { health, resources } = useServerLive();
    const visible = open ? servers : servers.slice(0, 1);
    if (servers.length === 0) return null;

    return (
        <div className="mt-4 rounded-lg border border-[#1b2742] bg-[#0b1222] p-3">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between text-[12px] text-white"
                aria-expanded={open}
                disabled={servers.length < 2}
            >
                Server status
                {servers.length > 1 && (
                    <ChevronDown className={clsx("h-4 w-4 text-white/60 transition-transform", open && "rotate-180")} />
                )}
            </button>
            {visible.map((server) => {
                const live = health?.find((h) => h.serverId === server.id);
                // Viewers don't get the owner-only live probe; fall back to the cron's last view.
                const state: ServerHealthState =
                    live?.state ?? (server.disabled ? "disabled" : server.status === "unreachable" ? "unreachable" : "online");
                const load = resources?.find((r) => r.serverId === server.id);
                return (
                    <div key={server.id} className="mt-3">
                        <div className="flex items-center gap-2 text-[12px] text-white" title={live?.message ?? undefined}>
                            <Database className="h-3.5 w-3.5 text-white/70" />
                            {server.name}
                            <span
                                className={clsx(
                                    "rounded px-1.5 py-0.5 text-[10px]",
                                    state === "online" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
                                )}
                            >
                                {HEALTH_LABEL[state]}
                            </span>
                            {live?.latencyMs !== undefined && live.latencyMs !== null && (
                                <span className="ml-auto text-[10px] text-white/50">{live.latencyMs} ms</span>
                            )}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] text-white/60">
                            {LOAD_TILES.map(({ key, label, icon: Icon }) => {
                                const value = load?.[key];
                                return (
                                    <div key={key} className="flex items-center gap-2">
                                        <Icon className="h-4 w-4 text-white/70" />
                                        <div>
                                            <p>{label}</p>
                                            <p className={clsx("text-[11px] font-semibold", value == null ? "text-white/40" : "text-white")}>
                                                {value == null ? "—" : `${value}%`}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function ServersPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const home = useHomeLight(days, serverId);
    const servers = useServers();
    const rows = home?.playsPerServer;
    const total = rows?.reduce((sum, r) => sum + r.plays, 0) ?? 0;

    return (
        <Panel id="servers" title="Servers" action={<ViewAll href="/settings/servers" />}>
            {!rows ? (
                <SkeletonRows count={4} rowClassName="h-5 rounded" />
            ) : rows.length === 0 ? (
                <EmptyRow />
            ) : (
                <table className="w-full text-[11px] text-white">
                    <thead>
                        <tr className="text-[9px] text-white/60">
                            <th className="pb-2 text-left font-normal">Server</th>
                            <th className="pb-2 text-right font-normal">Plays</th>
                            <th className="pb-2 text-right font-normal">Watch time</th>
                            <th className="pb-2 text-right font-normal">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const share = percentOf(row.plays, total);
                            const server = servers.find((s) => s.id === row.serverId);
                            return (
                                <tr key={row.serverId}>
                                    <td className="max-w-0 py-1.5">
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="h-2 w-2 shrink-0 rounded-full"
                                                style={{ backgroundColor: getServerColor(row.serverId, server?.color ?? null) }}
                                            />
                                            <span className="truncate">{row.serverName || "Unknown server"}</span>
                                        </span>
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums">{formatCount(row.plays)}</td>
                                    <td className="py-1.5 text-right tabular-nums">{formatHours(row.duration)}</td>
                                    <td className="py-1.5 pl-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="h-[3px] w-10 rounded-full bg-white/10">
                                                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${share}%` }} />
                                            </div>
                                            <span className="w-7 text-right tabular-nums">{share}%</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            <ServerStatus servers={servers.filter((s) => !s.archived)} />
        </Panel>
    );
}
