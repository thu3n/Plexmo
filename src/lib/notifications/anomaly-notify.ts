import type { TemplateVars } from "@/features/notifications/lib/events";
import { describeAnomaly } from "@/lib/stats/anomalies-describe";
import { markAnomalyNotified, type StoredAnomaly } from "@/lib/stats/anomalies-store";
import { dispatchNotification, type EmbedField } from "./dispatch";

const SEVERITY_LABELS: Record<StoredAnomaly["severity"], string> = {
    info: "Info",
    warning: "Warning",
    critical: "Critical",
};

/** Template vars + structured fields for one anomaly; exported for tests. */
export const anomalyMessage = (anomaly: StoredAnomaly): { vars: TemplateVars; fields: EmbedField[] } => {
    const { headline, detail, hint } = describeAnomaly(anomaly);
    return {
        vars: { server: anomaly.serverName ?? anomaly.serverId, title: headline, reason: detail },
        fields: [
            { name: "Severity", value: SEVERITY_LABELS[anomaly.severity], inline: true },
            { name: "What to check", value: hint, inline: false },
        ],
    };
};

/**
 * Announce newly opened anomalies. notifiedAt is stamped after the dispatch
 * attempt (whether or not any webhook subscribes) so an incident is offered
 * to Discord exactly once — a refresh of the same incident never re-sends.
 */
export const notifyAnomalies = async (anomalies: StoredAnomaly[], now: number = Date.now()): Promise<void> => {
    for (const anomaly of anomalies) {
        const { vars, fields } = anomalyMessage(anomaly);
        try {
            await dispatchNotification("anomaly", vars, fields);
        } catch (e) {
            console.error("Failed to send anomaly notification", e);
        }
        markAnomalyNotified(anomaly.id, now);
    }
};
