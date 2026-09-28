import { describe, it, expect } from "vitest";
import type { PlexSession } from "@/lib/plex/plex-types";
import { PAUSE_NOTIFY_COOLDOWN_MS, SessionEventTracker } from "@/lib/notifications/session-events";

const SRV = "srv";
const POLL_MS = 60_000;
const KEY = `${SRV}:1`;

const session = (overrides: Partial<PlexSession> = {}): PlexSession => ({
    id: KEY,
    sessionKey: "1",
    title: "Movie",
    user: "Alice",
    state: "playing",
    bandwidth: 0,
    progressPercent: 0,
    duration: 0,
    viewOffset: 0,
    isOriginalQuality: true,
    videoDecision: "direct play",
    ...overrides,
});

const types = (events: { type: string }[]) => events.map((e) => e.type);
const NONE = new Set<string>();

describe("SessionEventTracker", () => {
    it("fires pause and resume once each, not on every poll", () => {
        const t = new SessionEventTracker();
        let now = 0;
        expect(types(t.observe(SRV, [session()], new Set([KEY]), now))).toEqual([]);
        expect(types(t.observe(SRV, [session({ state: "paused" })], NONE, (now += POLL_MS)))).toEqual(["pause"]);
        expect(types(t.observe(SRV, [session({ state: "paused" })], NONE, (now += POLL_MS)))).toEqual([]);
        expect(types(t.observe(SRV, [session({ state: "paused" })], NONE, (now += POLL_MS)))).toEqual([]);
        expect(types(t.observe(SRV, [session()], NONE, (now += POLL_MS)))).toEqual(["resume"]);
        expect(types(t.observe(SRV, [session()], NONE, (now += POLL_MS)))).toEqual([]);
    });

    it("ignores buffering blips", () => {
        const t = new SessionEventTracker();
        t.observe(SRV, [session()], NONE, 0);
        expect(types(t.observe(SRV, [session({ state: "buffering" })], NONE, POLL_MS))).toEqual([]);
        expect(types(t.observe(SRV, [session()], NONE, 2 * POLL_MS))).toEqual([]);
    });

    it("suppresses a quick re-pause and its resume within the cooldown", () => {
        const t = new SessionEventTracker();
        t.observe(SRV, [session()], NONE, 0);
        expect(types(t.observe(SRV, [session({ state: "paused" })], NONE, 1000))).toEqual(["pause"]);
        expect(types(t.observe(SRV, [session()], NONE, 2000))).toEqual(["resume"]);
        expect(types(t.observe(SRV, [session({ state: "paused" })], NONE, 3000))).toEqual([]);
        expect(types(t.observe(SRV, [session()], NONE, 4000))).toEqual([]);
        const later = 1000 + PAUSE_NOTIFY_COOLDOWN_MS;
        expect(types(t.observe(SRV, [session({ state: "paused" })], NONE, later))).toEqual(["pause"]);
    });

    it("fires transcode once for a new transcoding session", () => {
        const t = new SessionEventTracker();
        const s = session({ videoDecision: "transcode" });
        expect(types(t.observe(SRV, [s], new Set([s.id]), 0))).toEqual(["transcode"]);
        expect(types(t.observe(SRV, [s], NONE, POLL_MS))).toEqual([]);
    });

    it("fires transcode once when a session switches to transcoding mid-stream", () => {
        const t = new SessionEventTracker();
        t.observe(SRV, [session()], new Set([KEY]), 0);
        expect(types(t.observe(SRV, [session({ videoDecision: "transcode" })], NONE, POLL_MS))).toEqual(["transcode"]);
        expect(types(t.observe(SRV, [session({ videoDecision: "direct play" })], NONE, 2 * POLL_MS))).toEqual([]);
        expect(types(t.observe(SRV, [session({ videoDecision: "transcode" })], NONE, 3 * POLL_MS))).toEqual([]);
    });

    it("seeds already-running sessions silently (e.g. after a restart)", () => {
        const t = new SessionEventTracker();
        const s = session({ state: "paused", videoDecision: "transcode" });
        expect(types(t.observe(SRV, [s], NONE, 0))).toEqual([]);
        expect(types(t.observe(SRV, [session({ videoDecision: "transcode" })], NONE, POLL_MS))).toEqual([]);
    });

    it("keeps servers independent and forgets ended sessions", () => {
        const t = new SessionEventTracker();
        t.observe(SRV, [session()], NONE, 0);
        t.observe("other", [], NONE, 0);
        expect(types(t.observe(SRV, [session({ state: "paused" })], NONE, POLL_MS))).toEqual(["pause"]);
        t.observe(SRV, [], NONE, 2 * POLL_MS);
        // Same key reappearing is a new stream: seeded silently, no stale resume.
        expect(types(t.observe(SRV, [session()], NONE, 3 * POLL_MS))).toEqual([]);
    });
});
