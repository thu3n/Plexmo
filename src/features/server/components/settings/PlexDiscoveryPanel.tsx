"use client";

import { useId } from "react";
import { Loader2 } from "lucide-react";
import type { DiscoveryStatus } from "../../hooks/usePlexDiscovery";
import { CONNECTION_KIND_LABEL, type DiscoveredConnection } from "../../lib/discovered-connections";

const connectionLabel = (c: DiscoveredConnection): string =>
    `${CONNECTION_KIND_LABEL[c.kind]}${c.secure ? " · https" : ""}${c.isBest ? " · recommended" : ""} — ${c.uri}`;

const groupByServer = (connections: DiscoveredConnection[]): [string, DiscoveredConnection[]][] => {
    const groups = new Map<string, DiscoveredConnection[]>();
    for (const c of connections) {
        const list = groups.get(c.resourceId) ?? [];
        list.push(c);
        groups.set(c.resourceId, list);
    }
    return [...groups.values()].map((list) => [list[0].serverName, list]);
};

/** Sign-in → pick a server connection. Presentational; state lives in usePlexDiscovery. */
export function PlexDiscoveryPanel({
    status,
    error,
    connections,
    selectedId,
    onSignIn,
    onRetry,
    onReset,
    onSelect,
}: {
    status: DiscoveryStatus;
    error: string | null;
    connections: DiscoveredConnection[];
    selectedId: string;
    onSignIn: () => void;
    onRetry: () => void;
    onReset: () => void;
    onSelect: (connection: DiscoveredConnection) => void;
}) {
    const selectId = useId();

    if (status === "idle" || status === "authenticating") {
        return (
            <div className="text-center py-8 space-y-3">
                <button
                    type="button"
                    onClick={onSignIn}
                    disabled={status === "authenticating"}
                    className="w-full py-4 rounded-xl bg-[#e5a00d] font-bold text-white hover:bg-[#d4940c] transition disabled:opacity-50"
                >
                    {status === "authenticating" ? "Waiting for Plex sign-in…" : "Sign In with Plex"}
                </button>
                {status === "authenticating" && (
                    <button type="button" onClick={onReset} className="text-sm text-white/50 hover:text-white">
                        Cancel
                    </button>
                )}
            </div>
        );
    }

    if (status === "loading") {
        return (
            <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-white/60">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Finding your Plex servers…
            </p>
        );
    }

    if (status === "error") {
        return (
            <div role="alert" className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300 space-y-3">
                <p>{error}</p>
                <div className="flex gap-4 font-bold">
                    <button type="button" onClick={onRetry} className="underline">Retry</button>
                    <button type="button" onClick={onReset} className="underline">Start over</button>
                </div>
            </div>
        );
    }

    if (connections.length === 0) {
        return (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60 space-y-2">
                <p>No Plex Media Servers were found on this Plex account. Use a different account, or add the server manually.</p>
                <button type="button" onClick={onReset} className="font-bold text-amber-400 hover:text-amber-300">
                    Sign in with another account
                </button>
            </div>
        );
    }

    return (
        <div className="mb-6 space-y-2">
            <label htmlFor={selectId} className="text-sm font-bold text-white">Select Server</label>
            <select
                id={selectId}
                value={selectedId}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white"
                onChange={(e) => {
                    const conn = connections.find((c) => c.id === e.target.value);
                    if (conn) onSelect(conn);
                }}
            >
                <option value="">Choose a server...</option>
                {groupByServer(connections).map(([serverName, list]) => (
                    <optgroup key={list[0].resourceId} label={serverName}>
                        {list.map((c) => (
                            <option key={c.id} value={c.id}>{connectionLabel(c)}</option>
                        ))}
                    </optgroup>
                ))}
            </select>
            <p className="text-xs text-white/40">
                Local connections are fastest when Plexmo runs on the same network. Relay is a bandwidth-limited fallback.
            </p>
        </div>
    );
}
