import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

const { dispatchNotification } = vi.hoisted(() => ({ dispatchNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/dispatch", () => ({ dispatchNotification }));

import { db } from "@/lib/db";
import { anomalyMessage, notifyAnomalies } from "@/lib/notifications/anomaly-notify";
import type { StoredAnomaly } from "@/lib/stats/anomalies-store";
import {
    DEFAULT_WEBHOOK_EVENTS,
    getEventDefinition,
    sanitizeEvents,
} from "@/features/notifications/lib/events";
import { renderMessage } from "@/features/notifications/lib/templates";

const anomaly = (over: Partial<StoredAnomaly> = {}): StoredAnomaly => ({
    id: 1,
    kind: "transcode_spike",
    serverId: "srv-a",
    serverName: "Home",
    subject: "",
    severity: "critical",
    observed: 0.6,
    baseline: 0.1,
    details: { transcodes: 12, streams: 20 },
    firstDetectedAt: 1,
    lastSeenAt: 1,
    notifiedAt: null,
    ...over,
});

beforeEach(() => {
    dispatchNotification.mockClear();
    db.prepare("DELETE FROM stat_anomalies").run();
});

describe("anomaly event definition", () => {
    it("is a known, opt-in event", () => {
        expect(sanitizeEvents(["anomaly", "nope"])).toEqual(["anomaly"]);
        expect(DEFAULT_WEBHOOK_EVENTS).not.toContain("anomaly");
        expect(getEventDefinition("anomaly").placeholders).toEqual(["server", "title", "reason"]);
    });

    it("renders the default template from the anomaly vars", () => {
        const { vars } = anomalyMessage(anomaly());
        const message = renderMessage("anomaly", vars, {});
        expect(message.title).toBe("📈 Transcode share spike");
        expect(message.description).toMatch(/^\*\*Home\*\*: 60% of streams transcoded/);
    });
});

describe("anomalyMessage", () => {
    it("adds severity and what-to-check fields, falling back to the server id", () => {
        const { vars, fields } = anomalyMessage(anomaly({ serverName: null, severity: "warning" }));
        expect(vars.server).toBe("srv-a");
        expect(fields.map((f) => f.name)).toEqual(["Severity", "What to check"]);
        expect(fields[0].value).toBe("Warning");
    });
});

describe("notifyAnomalies", () => {
    it("dispatches each incident as the anomaly event and stamps notifiedAt", async () => {
        const id = Number(
            db.prepare(
                `INSERT INTO stat_anomalies (kind, serverId, severity, observed, firstDetectedAt, lastSeenAt)
                 VALUES ('transcode_spike', 'srv-a', 'critical', 0.6, 1, 1)`
            ).run().lastInsertRowid,
        );
        await notifyAnomalies([anomaly({ id })], 1234);
        expect(dispatchNotification).toHaveBeenCalledWith("anomaly", expect.objectContaining({ server: "Home" }), expect.any(Array));
        expect(db.prepare("SELECT notifiedAt FROM stat_anomalies WHERE id = ?").get(id)).toEqual({ notifiedAt: 1234 });
    });

    it("still stamps the incident when the dispatch fails", async () => {
        dispatchNotification.mockRejectedValueOnce(new Error("boom"));
        const id = Number(
            db.prepare(
                `INSERT INTO stat_anomalies (kind, serverId, severity, observed, firstDetectedAt, lastSeenAt)
                 VALUES ('plays_drop', 'srv-a', 'warning', 0, 1, 1)`
            ).run().lastInsertRowid,
        );
        await notifyAnomalies([anomaly({ id, kind: "plays_drop" })], 99);
        expect(db.prepare("SELECT notifiedAt FROM stat_anomalies WHERE id = ?").get(id)).toEqual({ notifiedAt: 99 });
    });
});
