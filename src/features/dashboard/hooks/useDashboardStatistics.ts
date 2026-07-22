import { useMemo, useState } from "react";
import type { PlexSession } from "@/lib/plex";
import type { SessionSummary } from "@/lib/plex";
import type { PublicServer } from "@/lib/servers";

export function useDashboardStatistics(
    allSessions: PlexSession[],
    serverSummary: SessionSummary | null,
    servers: PublicServer[]
) {
    const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

    // Filter sessions based on selection
    const filteredSessions = useMemo(() => {
        if (!selectedServerId) return allSessions;
        return allSessions.filter(s => s.serverId === selectedServerId);
    }, [allSessions, selectedServerId]);

    // Recalculate summary based on filtered sessions
    const summary = useMemo(() => {
        if (!serverSummary) return {
            active: 0,
            directPlay: 0,
            directStream: 0,
            transcoding: 0,
            paused: 0,
            bandwidth: 0,
        };

        // If no filter, use server provided summary
        if (!selectedServerId) return serverSummary;

        // Recalculate for filtered view
        return filteredSessions.reduce((acc, session) => {
            acc.active++;
            acc.bandwidth += session.bandwidth || 0;

            const decision = session.decision?.toLowerCase();
            const isPaused = session.state?.toLowerCase() === "paused";

            if (isPaused) acc.paused++;
            else if (decision === "transcode") acc.transcoding++;
            else if (decision === "direct stream") acc.directStream++;
            else acc.directPlay++;

            return acc;
        }, {
            active: 0,
            directPlay: 0,
            directStream: 0,
            transcoding: 0,
            paused: 0,
            bandwidth: 0,
            serverName: servers.find(s => s.id === selectedServerId)?.name
        } as SessionSummary);
    }, [serverSummary, filteredSessions, selectedServerId, servers]);

    // Stats need to be calculated from ALL sessions to keep tags visible
    const statsSource = allSessions;

    // 1. Streams per Server
    const streamsPerServer = useMemo(() => statsSource.reduce((acc, session) => {
        const id = session.serverId || "unknown";
        const name = session.serverName || "Unknown";
        if (!acc[id]) acc[id] = { name, count: 0 };
        acc[id].count += 1;
        return acc;
    }, {} as Record<string, { name: string; count: number }>), [statsSource]);

    // 2. Direct Play per Server (true direct play — direct stream counted apart)
    const directPlayPerServer = useMemo(() => statsSource.reduce((acc, session) => {
        const decision = session.decision?.toLowerCase();
        if (decision !== "transcode" && decision !== "direct stream") {
            const id = session.serverId || "unknown";
            const name = session.serverName || "Unknown";
            if (!acc[id]) acc[id] = { name, count: 0 };
            acc[id].count += 1;
        }
        return acc;
    }, {} as Record<string, { name: string; count: number }>), [statsSource]);

    // 2b. Direct Stream per Server (container remux)
    const directStreamPerServer = useMemo(() => statsSource.reduce((acc, session) => {
        if (session.decision?.toLowerCase() === "direct stream") {
            const id = session.serverId || "unknown";
            const name = session.serverName || "Unknown";
            if (!acc[id]) acc[id] = { name, count: 0 };
            acc[id].count += 1;
        }
        return acc;
    }, {} as Record<string, { name: string; count: number }>), [statsSource]);

    // 3. Transcode per Server
    const transcodePerServer = useMemo(() => statsSource.reduce((acc, session) => {
        const isTranscode = session.decision?.toLowerCase() === "transcode";
        if (isTranscode) {
            const id = session.serverId || "unknown";
            const name = session.serverName || "Unknown";
            if (!acc[id]) acc[id] = { name, count: 0 };
            acc[id].count += 1;
        }
        return acc;
    }, {} as Record<string, { name: string; count: number }>), [statsSource]);

    // 4. Bandwidth per Server
    const bandwidthPerServer = useMemo(() => {
        const bw = statsSource.reduce((acc, session) => {
            const id = session.serverId || "unknown";
            const name = session.serverName || "Unknown";
            const bandwidth = session.bandwidth || 0;

            if (!acc[id]) acc[id] = { name, count: 0 };
            acc[id].count += bandwidth;
            return acc;
        }, {} as Record<string, { name: string; count: number; label?: string }>);

        // Format bandwidth labels
        const formatBandwidth = (value: number) => {
            if (!value) return "0 Mbps";
            const mbps = value / 1000;
            return `${mbps.toFixed(1)} Mbps`;
        };

        Object.keys(bw).forEach(id => {
            bw[id].label = formatBandwidth(bw[id].count);
        });

        return bw;
    }, [statsSource]);

    return {
        selectedServerId,
        filteredSessions,
        summary,
        setSelectedServerId,
        streamsPerServer,
        directPlayPerServer,
        directStreamPerServer,
        transcodePerServer,
        bandwidthPerServer
    };
}
