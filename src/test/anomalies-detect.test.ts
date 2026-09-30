import { describe, expect, it } from "vitest";
import {
    BASELINE_DAYS,
    MIN_EXPECTED_DAILY_PLAYS,
    MIN_TRANSCODE_SAMPLE,
    NEW_CLIENT_MIN_BASELINE_PLAYS,
    SILENT_MIN_ACTIVE_DAYS,
    clientSubject,
    detectAnomalies,
    detectNewClient,
    detectPlaysChange,
    detectSilentServer,
    detectTranscodeSpike,
    type NewClientMetrics,
    type ServerWindowMetrics,
} from "@/lib/stats/anomalies-detect";
import { describeAnomaly } from "@/lib/stats/anomalies-describe";

const metrics = (over: Partial<ServerWindowMetrics> = {}): ServerWindowMetrics => ({
    serverId: "srv-a",
    currentPlays: 10,
    currentKnownDecisions: 20,
    currentTranscodes: 2,
    baselinePlays: 140,
    baselineKnownDecisions: 140,
    baselineTranscodes: 14,
    silentWindowPlays: 20,
    silentBaselineActiveDays: 14,
    ...over,
});

const client = (over: Partial<NewClientMetrics> = {}): NewClientMetrics => ({
    serverId: "srv-a",
    platform: "Roku",
    client: "Living Room",
    plays: 4,
    transcodes: 4,
    users: ["alice"],
    ...over,
});

describe("detectTranscodeSpike", () => {
    it("flags a large rise over the baseline share", () => {
        const a = detectTranscodeSpike(metrics({ currentTranscodes: 8 }));
        expect(a).toMatchObject({ kind: "transcode_spike", severity: "warning", observed: 0.4, baseline: 0.1 });
    });

    it("escalates to critical on a very large rise", () => {
        expect(detectTranscodeSpike(metrics({ currentTranscodes: 12 }))?.severity).toBe("critical");
    });

    it("ignores small samples and modest rises", () => {
        expect(detectTranscodeSpike(metrics({ currentKnownDecisions: MIN_TRANSCODE_SAMPLE - 1, currentTranscodes: 9 }))).toBeNull();
        expect(detectTranscodeSpike(metrics({ baselineKnownDecisions: 5, baselineTranscodes: 0, currentTranscodes: 15 }))).toBeNull();
        // 25% vs 10%: only +15 percentage points.
        expect(detectTranscodeSpike(metrics({ currentTranscodes: 5 }))).toBeNull();
    });

    it("requires the ratio too, not just the delta", () => {
        // 70% vs 50%: +20pp but only 1.4x.
        expect(detectTranscodeSpike(metrics({ currentTranscodes: 14, baselineTranscodes: 70 }))).toBeNull();
    });
});

describe("detectSilentServer", () => {
    it("flags zero plays on a normally busy server", () => {
        expect(detectSilentServer(metrics({ silentWindowPlays: 0 }))).toMatchObject({ kind: "server_silent", severity: "critical" });
    });

    it("stays quiet for servers that are often idle", () => {
        expect(detectSilentServer(metrics({ silentWindowPlays: 0, silentBaselineActiveDays: SILENT_MIN_ACTIVE_DAYS - 1 }))).toBeNull();
    });
});

describe("detectPlaysChange", () => {
    it("flags a drop and a spike against the daily average", () => {
        expect(detectPlaysChange(metrics({ currentPlays: 2 }))?.kind).toBe("plays_drop");
        expect(detectPlaysChange(metrics({ currentPlays: 40 }))).toMatchObject({ kind: "plays_spike", severity: "info", baseline: 10 });
        expect(detectPlaysChange(metrics({ currentPlays: 12 }))).toBeNull();
    });

    it("needs a meaningful daily average", () => {
        const quiet = metrics({ baselinePlays: (MIN_EXPECTED_DAILY_PLAYS - 1) * BASELINE_DAYS, currentPlays: 0 });
        expect(detectPlaysChange(quiet)).toBeNull();
    });

    it("needs a spike to add enough plays in absolute terms", () => {
        // Average 5/day: 15 is 3x and +10 (passes); 14 is not 3x.
        const small = metrics({ baselinePlays: 5 * BASELINE_DAYS });
        expect(detectPlaysChange({ ...small, currentPlays: 15 })?.kind).toBe("plays_spike");
        expect(detectPlaysChange({ ...small, currentPlays: 14 })).toBeNull();
    });
});

describe("detectNewClient", () => {
    it("flags a new client that mostly transcodes on an established server", () => {
        const a = detectNewClient(client(), NEW_CLIENT_MIN_BASELINE_PLAYS);
        expect(a).toMatchObject({ kind: "client_transcodes", subject: "Roku · Living Room", observed: 4 });
    });

    it("ignores new servers and clients that mostly direct play", () => {
        expect(detectNewClient(client(), NEW_CLIENT_MIN_BASELINE_PLAYS - 1)).toBeNull();
        expect(detectNewClient(client({ plays: 10, transcodes: 3 }), 100)).toBeNull();
    });

    it("labels missing names and bounds the subject length", () => {
        expect(clientSubject(null, "  ")).toBe("Unknown · Unknown");
        expect(clientSubject("x".repeat(500), "y").length).toBe(200);
    });
});

describe("detectAnomalies", () => {
    it("does not report the drop of a silent server twice", () => {
        const found = detectAnomalies([metrics({ silentWindowPlays: 0, currentPlays: 0 })], []);
        expect(found.map((a) => a.kind)).toEqual(["server_silent"]);
    });

    it("uses each server's own baseline for new clients", () => {
        const found = detectAnomalies(
            [metrics({ serverId: "busy" }), metrics({ serverId: "fresh", baselinePlays: 0, currentPlays: 4 })],
            [client({ serverId: "busy" }), client({ serverId: "fresh" })],
        );
        expect(found.filter((a) => a.kind === "client_transcodes").map((a) => a.serverId)).toEqual(["busy"]);
    });
});

describe("describeAnomaly", () => {
    it("words every kind with a hint", () => {
        const found = detectAnomalies(
            [
                metrics({ currentTranscodes: 12 }),
                metrics({ serverId: "b", silentWindowPlays: 0 }),
                metrics({ serverId: "c", currentPlays: 40 }),
                metrics({ serverId: "d", currentPlays: 1 }),
            ],
            [client({ users: ["a", "b", "c", "d"] })],
        );
        expect(new Set(found.map((a) => a.kind)).size).toBe(5);
        for (const a of found) {
            const text = describeAnomaly(a);
            expect(text.headline).not.toBe("");
            expect(text.hint).not.toBe("");
        }
        const spike = describeAnomaly(found.find((a) => a.kind === "transcode_spike")!);
        expect(spike.detail).toContain("60% of streams");
        const newClient = describeAnomaly(found.find((a) => a.kind === "client_transcodes")!);
        expect(newClient.detail).toContain("(a, b, c +1)");
    });
});
