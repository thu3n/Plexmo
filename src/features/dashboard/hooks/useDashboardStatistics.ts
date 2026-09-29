import { useMemo, useState } from "react";
import type { PlexSession } from "@/lib/plex";
import type { PublicServer } from "@/lib/servers";
import { summarizeSessions } from "../utils/sessionSummary";

export type ServerStreamCount = { name: string; count: number };

export function useDashboardStatistics(allSessions: PlexSession[], servers: PublicServer[]) {
    const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

    const filteredSessions = useMemo(() => {
        if (!selectedServerId) return allSessions;
        return allSessions.filter(s => s.serverId === selectedServerId);
    }, [allSessions, selectedServerId]);

    const summary = useMemo(() => summarizeSessions(filteredSessions), [filteredSessions]);

    // Every configured server is listed (0 when idle) so idle or unreachable
    // servers stay visible and filterable; counts come from ALL sessions so
    // the filter row doesn't collapse to the selected server.
    const streamsPerServer = useMemo(() => {
        const counts: Record<string, ServerStreamCount> = Object.fromEntries(
            servers.map((s) => [s.id, { name: s.name, count: 0 }]),
        );
        for (const session of allSessions) {
            const id = session.serverId || "unknown";
            counts[id] ??= { name: session.serverName || "Unknown", count: 0 };
            counts[id].count += 1;
        }
        return counts;
    }, [allSessions, servers]);

    return {
        selectedServerId,
        filteredSessions,
        summary,
        setSelectedServerId,
        streamsPerServer,
    };
}
