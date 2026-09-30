"use client";

import { RelayPanel } from "./RelayPanel";
import { TranscodeReasonsPanel } from "./TranscodeReasonsPanel";
import { TranscodingClientsPanel } from "./TranscodingClientsPanel";
import { WanLoadPanel } from "./WanLoadPanel";

/**
 * All server-health panels in one mobile-first grid, for a single drop-in
 * under the Server section. The panels are also exported individually.
 */
export function ServerQualitySection({ days, serverId }: { days: number; serverId: string | null }) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TranscodeReasonsPanel days={days} serverId={serverId} />
            <TranscodingClientsPanel days={days} serverId={serverId} />
            <WanLoadPanel days={days} serverId={serverId} />
            <RelayPanel days={days} serverId={serverId} />
        </div>
    );
}
