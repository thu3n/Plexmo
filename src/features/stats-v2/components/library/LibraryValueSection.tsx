"use client";

import { CostPerPlayPanel } from "./CostPerPlayPanel";
import { CoveragePanel } from "./CoveragePanel";
import { DeadWeightPanel } from "./DeadWeightPanel";
import { FirstPlayPanel } from "./FirstPlayPanel";

/**
 * The four library-value panels in their intended layout: the two ranked lists
 * side by side, the two summaries below. Single column on mobile.
 * Lifetime metrics — the page's period selector does not apply.
 */
export function LibraryValueSection({ serverId }: { serverId: string | null }) {
    return (
        <div id="library-value" className="grid scroll-mt-24 grid-cols-1 gap-4 lg:grid-cols-2">
            <DeadWeightPanel serverId={serverId} />
            <CostPerPlayPanel serverId={serverId} />
            <FirstPlayPanel serverId={serverId} />
            <CoveragePanel serverId={serverId} />
        </div>
    );
}
