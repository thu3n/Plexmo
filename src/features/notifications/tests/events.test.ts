import { describe, it, expect } from "vitest";
import { NOTIFICATION_EVENTS, NOTIFICATION_EVENT_IDS, sanitizeEvents, webhookWantsEvent } from "../lib/events";

describe("event definitions", () => {
    it("define every event id exactly once", () => {
        expect(NOTIFICATION_EVENTS.map((e) => e.id).sort()).toEqual([...NOTIFICATION_EVENT_IDS].sort());
    });

    it("keep the legacy stored ids", () => {
        expect(NOTIFICATION_EVENT_IDS).toEqual(expect.arrayContaining(["start", "stop", "terminate"]));
    });
});

describe("sanitizeEvents", () => {
    it("keeps legacy arrays intact and drops unknown or duplicate values", () => {
        expect(sanitizeEvents(["start", "stop", "terminate"])).toEqual(["start", "stop", "terminate"]);
        expect(sanitizeEvents(["start", "start", "nonsense", 3, "server_down"])).toEqual(["start", "server_down"]);
    });

    it("returns empty for non-arrays", () => {
        expect(sanitizeEvents("start")).toEqual([]);
        expect(sanitizeEvents(undefined)).toEqual([]);
    });
});

describe("webhookWantsEvent", () => {
    it("matches subscribed events only, and test reaches everyone", () => {
        expect(webhookWantsEvent(["start"], "start")).toBe(true);
        expect(webhookWantsEvent(["start"], "pause")).toBe(false);
        expect(webhookWantsEvent([], "test")).toBe(true);
    });
});
