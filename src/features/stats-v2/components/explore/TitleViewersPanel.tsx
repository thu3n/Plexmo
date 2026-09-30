"use client";

import { useState } from "react";
import { avatarSrc } from "@/lib/avatar";
import type { TitleType } from "@/lib/stats/title-detail-query";
import type { TitleViewer } from "@/lib/stats/title-detail";
import { DEFAULT_LIST_LIMIT, ExpandToggle, Panel } from "../Panel";
import { RankedList, type RankedRow } from "../RankedList";
import { formatCount, formatHours } from "../../lib/overview-math";
import { formatCompletion } from "../../lib/explore-math";

const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

const toRow = (viewer: TitleViewer, isShow: boolean, isClient: boolean): RankedRow => ({
    key: viewer.accountId,
    label: viewer.user,
    // Same user-page link as the overview's Top users panel.
    href: `/settings/users/${encodeURIComponent(viewer.user)}?from=statistics`,
    sub: [
        isClient ? `Last ${new Date(viewer.lastWatched).toLocaleDateString("en-US", DATE_FMT)}` : null,
        `${formatHours(viewer.seconds)} watched`,
    ].filter(Boolean).join(" · "),
    // eslint-disable-next-line @next/next/no-img-element
    icon: <img src={avatarSrc(viewer.thumb, viewer.user)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />,
    values: [
        formatCount(viewer.plays),
        isShow ? formatCount(viewer.episodes ?? 0) : formatCompletion(viewer.completion),
    ],
    magnitude: viewer.plays,
});

/** Who watched this title — plays, and how far they got (episodes for shows). */
export function TitleViewersPanel({
    viewers,
    type,
    isClient,
}: {
    viewers: TitleViewer[] | undefined;
    type: TitleType | undefined;
    isClient: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const isShow = type === "show";
    const shown = expanded ? viewers : viewers?.slice(0, DEFAULT_LIST_LIMIT);

    return (
        <Panel id="viewers" title="Who watched" className="flex flex-col">
            <div className="flex-1">
                <RankedList
                    columns={["Plays", isShow ? "Episodes" : "Furthest"]}
                    rows={shown?.map((v) => toRow(v, isShow, isClient))}
                    skeletonRows={DEFAULT_LIST_LIMIT}
                    emptyText="Nobody watched this in the period"
                />
            </div>
            {viewers && viewers.length > DEFAULT_LIST_LIMIT && (
                <div className="mt-3 text-right">
                    <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
                </div>
            )}
        </Panel>
    );
}
