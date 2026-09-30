"use client";

import { ClientsPanel, TopUsersPanel } from "../PeoplePanels";
import { PeopleInsightsSection } from "../people/PeopleInsightsSection";
import type { StatsScope } from "./types";

/** Who watches, on what, and how the audience is changing. */
export function PeopleSection({ scope }: { scope: StatsScope }) {
    return (
        <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
                <TopUsersPanel {...scope} />
                <ClientsPanel {...scope} />
            </div>
            <PeopleInsightsSection {...scope} />
        </div>
    );
}
