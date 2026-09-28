"use client";

import { Edit2, Pause, Play, Trash2 } from "lucide-react";
import clsx from "clsx";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { getServerColor } from "@/lib/serverColors";
import type { PublicServer } from "@/lib/servers";
import type { ServerHealth } from "@/lib/server-health";
import { ServerHealthStatus } from "./ServerHealthStatus";

const ACTION_BUTTON = "p-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500";

export function ServerSettingsCard({
    server,
    health,
    healthLoading,
    healthError,
    onEdit,
    onToggleDisabled,
    onRemove,
}: {
    server: PublicServer;
    health: ServerHealth | undefined;
    healthLoading: boolean;
    healthError: boolean;
    onEdit: () => void;
    onToggleDisabled: () => void;
    onRemove: () => void;
}) {
    const color = getServerColor(server.id, server.color);

    return (
        <SettingsCard className="group relative flex flex-col justify-between min-h-[200px]">
            <div>
                <div className="flex items-start justify-between mb-4">
                    <div className={clsx("p-3 rounded-2xl bg-white/5", server.disabled && "opacity-50")}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></svg>
                    </div>
                    {/* Always visible on touch/small screens (no hover); on desktop revealed on hover OR keyboard focus */}
                    <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity">
                        <button
                            type="button"
                            onClick={onEdit}
                            aria-label={`Edit ${server.name}`}
                            title="Edit"
                            className={clsx(ACTION_BUTTON, "hover:bg-white/10 active:bg-white/20 text-white/70 hover:text-white")}
                        >
                            <Edit2 className="w-4 h-4" aria-hidden />
                        </button>
                        <button
                            type="button"
                            onClick={onToggleDisabled}
                            aria-label={server.disabled ? `Resume monitoring ${server.name}` : `Pause monitoring ${server.name}`}
                            title={server.disabled ? "Resume monitoring" : "Pause monitoring"}
                            className={clsx(ACTION_BUTTON, "hover:bg-white/10 active:bg-white/20 text-white/70 hover:text-white")}
                        >
                            {server.disabled ? <Play className="w-4 h-4" aria-hidden /> : <Pause className="w-4 h-4" aria-hidden />}
                        </button>
                        <button
                            type="button"
                            onClick={onRemove}
                            aria-label={`Remove ${server.name}`}
                            title="Remove"
                            className={clsx(ACTION_BUTTON, "hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 hover:text-rose-300")}
                        >
                            <Trash2 className="w-4 h-4" aria-hidden />
                        </button>
                    </div>
                </div>
                <h3 className={clsx("text-xl font-bold mb-1", server.disabled ? "text-white/60" : "text-white")}>{server.name}</h3>
                <p className="text-xs text-white/40 truncate font-mono">{server.baseUrl}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center">
                <ServerHealthStatus health={health} isLoading={healthLoading} loadError={healthError} />
            </div>
        </SettingsCard>
    );
}
