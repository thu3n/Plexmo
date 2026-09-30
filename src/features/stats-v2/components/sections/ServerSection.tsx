"use client";

import { TranscodingDetailsPanel } from "../PlaybackPanels";
import { ServersPanel } from "../ServersPanel";
import { AnomaliesPanel } from "../insights/AnomaliesPanel";
import { ServerQualitySection } from "../quality/ServerQualitySection";
import type { StatsScope } from "./types";

/** Anomalies, server health and delivery quality — where an admin can act. */
export function ServerSection({ scope }: { scope: StatsScope }) {
    return (
        <div className="grid gap-4">
            {/* Unusual activity first: it's the one panel that says "something changed". */}
            <AnomaliesPanel {...scope} />
            <ServersPanel {...scope} />
            <ServerQualitySection {...scope} />
            <TranscodingDetailsPanel {...scope} />
        </div>
    );
}
