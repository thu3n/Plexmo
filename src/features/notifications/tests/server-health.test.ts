import { describe, it, expect } from "vitest";
import {
    SERVER_DOWN_MIN_DURATION_MS,
    SERVER_DOWN_MIN_FAILURES,
    ServerHealthTracker,
} from "@/lib/notifications/server-health";

const SRV = "srv";
const POLL_MS = 60_000;

describe("ServerHealthTracker", () => {
    it("does not fire on a single failed poll", () => {
        const t = new ServerHealthTracker();
        expect(t.recordFailure(SRV, 0)).toBeNull();
        expect(t.recordSuccess(SRV, POLL_MS)).toBeNull();
    });

    it("needs both the failure count and the minimum duration", () => {
        const t = new ServerHealthTracker();
        // Many rapid failures (WebSocket-kicked reruns) are not enough on their own.
        for (let i = 0; i < SERVER_DOWN_MIN_FAILURES * 3; i++) {
            expect(t.recordFailure(SRV, i * 1000)).toBeNull();
        }
        expect(t.recordFailure(SRV, SERVER_DOWN_MIN_DURATION_MS)).toEqual({
            type: "server_down",
            outageMs: SERVER_DOWN_MIN_DURATION_MS,
        });
    });

    it("fires down once, then up once with the outage length", () => {
        const t = new ServerHealthTracker();
        const events = [];
        for (let i = 0; i <= 5; i++) events.push(t.recordFailure(SRV, i * POLL_MS));
        expect(events.filter(Boolean)).toHaveLength(1);
        expect(t.recordSuccess(SRV, 10 * POLL_MS)).toEqual({ type: "server_up", outageMs: 10 * POLL_MS });
        expect(t.recordSuccess(SRV, 11 * POLL_MS)).toBeNull();
    });

    it("resets the failure streak on success", () => {
        const t = new ServerHealthTracker();
        t.recordFailure(SRV, 0);
        t.recordFailure(SRV, POLL_MS);
        t.recordSuccess(SRV, 2 * POLL_MS);
        expect(t.recordFailure(SRV, 3 * POLL_MS)).toBeNull();
        expect(t.recordFailure(SRV, 4 * POLL_MS)).toBeNull();
    });
});
