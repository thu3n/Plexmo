"use client";

import { useState } from "react";
import { DEFAULT_LIST_LIMIT, EXPANDED_LIMIT, ExpandToggle, Panel } from "../Panel";
import { InitialBadge, RankedList } from "../RankedList";
import { formatCount, formatHours } from "../../lib/overview-math";
import { useTopGenres } from "../../hooks/people";

type Scope = { days: number; serverId: string | null };

const COLUMNS = ["Plays", "Watched"];
const NO_GENRE_DATA_TEXT = "Genres appear after the next library sync";

/** Top genres across everyone in scope (qualified plays, titles deduped across servers). */
export function GenresPanel({ days, serverId }: Scope) {
    const [expanded, setExpanded] = useState(false);
    const limit = expanded ? EXPANDED_LIMIT : DEFAULT_LIST_LIMIT;
    const data = useTopGenres(days, serverId, limit);

    const rows = data?.items.map((g) => ({
        key: g.genre,
        label: g.genre,
        sub: `${formatCount(g.users)} ${g.users === 1 ? "user" : "users"}`,
        icon: <InitialBadge label={g.genre} />,
        values: [formatCount(g.plays), formatHours(g.seconds)],
        magnitude: g.plays,
    }));

    return (
        <Panel id="genres" title="Genres" className="flex flex-col">
            <div className="flex-1">
                <RankedList
                    columns={COLUMNS}
                    rows={rows}
                    skeletonRows={limit}
                    emptyText={data && !data.hasGenreData ? NO_GENRE_DATA_TEXT : undefined}
                />
            </div>
            <div className="mt-3 text-right">
                <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
        </Panel>
    );
}
