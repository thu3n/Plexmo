"use client";

import { CalendarHeatmap } from "../explore/CalendarHeatmap";
import { ViewingBehaviourSection } from "../behaviour/ViewingBehaviourSection";
import type { StatsScope } from "./types";

/** How people watch — the year at a glance, then completion, binges, drop-off. */
export function ViewingSection({ scope }: { scope: StatsScope }) {
    return (
        <div className="grid gap-4">
            <CalendarHeatmap serverId={scope.serverId} />
            <ViewingBehaviourSection {...scope} />
        </div>
    );
}
