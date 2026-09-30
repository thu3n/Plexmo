"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel, Tabs, type TabOption } from "../Panel";
import { RankedList, type RankedRow } from "../RankedList";
import { formatCount } from "../../lib/overview-math";
import { useRelayShare } from "../../hooks/quality";

type RelayView = "users" | "servers";

const VIEWS: TabOption<RelayView>[] = [
    { key: "users", label: "Users" },
    { key: "servers", label: "Servers" },
];

/** Share of remote plays through Plex Relay, and who/where: a port-forwarding health check. */
export function RelayPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [view, setView] = useState<RelayView>("users");
    const [expanded, setExpanded] = useState(false);
    const data = useRelayShare(days, serverId, expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT);

    const rows = useMemo<RankedRow[] | undefined>(() => {
        if (!data) return undefined;
        const source = view === "users"
            ? data.users.map((u) => ({ key: u.userId, label: u.user, wanPlays: u.wanPlays, relayed: u.relayed, share: u.share }))
            : data.servers.map((s) => ({ key: s.serverId, label: s.name, wanPlays: s.wanPlays, relayed: s.relayed, share: s.share }));
        return source.map((row) => ({
            key: row.key,
            label: row.label,
            sub: `${formatCount(row.wanPlays)} remote plays`,
            values: [formatCount(row.relayed), `${row.share}%`],
            magnitude: row.relayed,
        }));
    }, [data, view]);

    const emptyText = data && data.wanPlays === 0
        ? "No remote plays in this period"
        : "No relayed plays: direct connections work";

    return (
        <Panel id="quality-relay" title="Plex Relay" action={<Tabs options={VIEWS} value={view} onChange={setView} size="sm" />}>
            {!data ? (
                <Skeleton className="mb-4 h-12 rounded-lg" />
            ) : (
                <div className="mb-4 flex items-baseline gap-3">
                    <p className="text-2xl font-semibold tabular-nums text-white">{data.share}%</p>
                    <p className="text-xs text-white/55">of {formatCount(data.knownPlays)} remote plays relayed</p>
                </div>
            )}
            {data?.warning && (
                <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs leading-snug text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{data.warning}</span>
                </p>
            )}
            <RankedList rows={rows} columns={["Relayed", "Share"]} skeletonRows={4} emptyText={emptyText} />
            {view === "users" && data && data.users.length >= DEFAULT_LIST_LIMIT && (
                <div className="mt-3 flex justify-end">
                    <ExpandToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
                </div>
            )}
        </Panel>
    );
}
