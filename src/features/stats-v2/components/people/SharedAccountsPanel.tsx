"use client";

import { useState } from "react";
import { avatarSrc } from "@/lib/avatar";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel } from "../Panel";
import { RankedList } from "../RankedList";
import { formatCount } from "../../lib/overview-math";
import { useSharedAccounts } from "../../hooks/people";
import { formatShortDate, userHref } from "./people-format";

type Scope = { days: number; serverId: string | null };

const COLUMNS = ["Overlaps", "IPs"];

/**
 * Accounts seen streaming at the same time from different addresses. Owner
 * only — the API answers 403 to everyone else and the panel renders nothing.
 */
export function SharedAccountsPanel({ days, serverId }: Scope) {
    const [expanded, setExpanded] = useState(false);
    const limit = expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT;
    const data = useSharedAccounts(days, serverId, limit);
    if (data === "forbidden") return null;

    const rows = data?.items.map((s) => ({
        key: s.accountId,
        label: s.user,
        sub: `Last ${formatShortDate(s.lastOccurrence)}`,
        href: userHref(s.user),
        // eslint-disable-next-line @next/next/no-img-element
        icon: <img src={avatarSrc(s.thumb, s.user)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />,
        values: [formatCount(s.incidents), formatCount(s.distinctIps)],
        magnitude: s.incidents,
    }));

    return (
        <Panel id="shared-accounts" title="Possible shared accounts" className="flex flex-col">
            <p className="mb-3 text-xs text-white/55">
                Same account streaming concurrently from different IPs. LAN households are ignored.
            </p>
            <div className="flex-1">
                <RankedList
                    columns={COLUMNS}
                    rows={rows}
                    skeletonRows={4}
                    emptyText="No overlapping streams from different IPs"
                />
            </div>
            {rows && rows.length >= DEFAULT_LIST_LIMIT && (
                <div className="mt-3 text-right">
                    <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
                </div>
            )}
        </Panel>
    );
}
