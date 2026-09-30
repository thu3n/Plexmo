"use client";

import { AbandonedPanel } from "./AbandonedPanel";
import { BingePanel } from "./BingePanel";
import { CompletionPanel } from "./CompletionPanel";
import { PausePanel } from "./PausePanel";

/**
 * The four viewing-behaviour panels in their intended layout: completion and
 * binges side by side (both lead with a headline row), abandoned series and
 * pause intensity below. Single column on mobile. All follow the page period.
 */
export function ViewingBehaviourSection({ days, serverId }: { days: number; serverId: string | null }) {
    return (
        <div id="viewing-behaviour" className="grid scroll-mt-24 grid-cols-1 gap-4 lg:grid-cols-2">
            <CompletionPanel days={days} serverId={serverId} />
            <BingePanel days={days} serverId={serverId} />
            <AbandonedPanel days={days} serverId={serverId} />
            <PausePanel days={days} serverId={serverId} />
        </div>
    );
}
