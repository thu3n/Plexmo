"use client";

import { useMemo, useState } from "react";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel } from "../Panel";
import { InitialBadge, RankedList, type RankedRow } from "../RankedList";
import { formatCount } from "../../lib/overview-math";
import { useTranscodingClients } from "../../hooks/quality";
import { REASON_LABELS } from "@/lib/stats/server-quality-hints";

/** Platform + player combinations ranked by how many transcodes they cause. */
export function TranscodingClientsPanel({ days, serverId }: { days: number; serverId: string | null }) {
    const [expanded, setExpanded] = useState(false);
    const data = useTranscodingClients(days, serverId, expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT);

    const rows = useMemo<RankedRow[] | undefined>(
        () =>
            data?.items.map((client) => ({
                key: `${client.platform}|${client.player}`,
                label: client.player === client.platform ? client.player : `${client.player} · ${client.platform}`,
                sub: [
                    client.topReason ? `Mostly ${REASON_LABELS[client.topReason].toLowerCase()}` : null,
                    `${formatCount(client.plays)} plays`,
                ].filter(Boolean).join(" · "),
                icon: <InitialBadge label={client.platform} />,
                values: [formatCount(client.transcodes), `${client.share}%`],
                magnitude: client.transcodes,
            })),
        [data],
    );

    return (
        <Panel
            id="quality-clients"
            title="Clients causing transcodes"
            action={data && data.items.length >= DEFAULT_LIST_LIMIT && (
                <ExpandToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
            )}
        >
            <RankedList
                rows={rows}
                columns={["Count", "Share"]}
                skeletonRows={6}
                emptyText="No client transcoded in this period"
            />
        </Panel>
    );
}
