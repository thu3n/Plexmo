"use client";

import clsx from "clsx";
import type { ServerHealth, ServerHealthState } from "@/lib/server-health";
import { formatLastSeen } from "../../lib/format-last-seen";

const STATE_STYLE: Record<ServerHealthState, { label: string; dot: string; text: string }> = {
    online: { label: "Online", dot: "bg-emerald-500", text: "text-emerald-500" },
    unauthorized: { label: "Token rejected", dot: "bg-rose-500", text: "text-rose-400" },
    unreachable: { label: "Unreachable", dot: "bg-rose-500", text: "text-rose-400" },
    disabled: { label: "Paused", dot: "bg-white/30", text: "text-white/50" },
};

/** Card footer: live health from /api/servers/status, with loading and error states. */
export function ServerHealthStatus({
    health,
    isLoading,
    loadError,
}: {
    health: ServerHealth | undefined;
    isLoading: boolean;
    loadError: boolean;
}) {
    if (!health) {
        return (
            <p className="text-xs font-bold uppercase tracking-wider text-white/40" role="status">
                {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-white/30 animate-pulse" aria-hidden />
                        Checking…
                    </span>
                ) : loadError ? (
                    "Status unavailable"
                ) : (
                    "Status unknown"
                )}
            </p>
        );
    }

    const style = STATE_STYLE[health.state];
    const lastSeen = formatLastSeen(health.lastSeenAt);
    const details = [
        health.version && `Plex ${health.version}`,
        health.latencyMs != null && health.state === "online" && `${health.latencyMs} ms`,
        health.state !== "online" && lastSeen && `last seen ${lastSeen}`,
    ].filter(Boolean);

    return (
        <div className="min-w-0 space-y-1" role="status">
            <p className={clsx("flex items-center gap-2 text-xs font-bold uppercase tracking-wider", style.text)}>
                <span className={clsx("h-2 w-2 shrink-0 rounded-full", style.dot)} aria-hidden />
                {style.label}
            </p>
            {details.length > 0 && <p className="text-xs text-white/40 truncate">{details.join(" · ")}</p>}
            {health.message && health.state !== "online" && health.state !== "disabled" && (
                <p className="text-xs text-rose-300/70 line-clamp-2" title={health.message}>
                    {health.message}
                </p>
            )}
        </div>
    );
}
