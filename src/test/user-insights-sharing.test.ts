import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { MIN_OVERLAP_MS, getSharedAccountSuspects, isPrivateIp } from "@/lib/stats/user-insights-sharing";
import { insertIdentity, insertPlay, resetPeopleTables } from "./user-insights-test-utils";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const UNTIL = new Date(2026, 6, 20, 12, 0, 0).getTime();
const SINCE = UNTIL - 30 * 24 * HOUR;
const T0 = UNTIL - 5 * 24 * HOUR;

const stream = (userId: string, start: number, lengthMs: number, ip: string, location = "wan", serverId = "srv-a") =>
    insertPlay({ userId, startTime: start, stopTime: start + lengthMs, ip, location, serverId });

const suspects = (params: { serverId?: string; allowedServerIds?: string[]; limit?: number } = {}) =>
    getSharedAccountSuspects({ since: SINCE, until: UNTIL, ...params });

beforeEach(() => {
    resetPeopleTables();
});

describe("isPrivateIp", () => {
    it.each(["10.0.0.4", "192.168.1.20", "172.16.3.1", "172.31.9.9", "127.0.0.1", "::1", "fd12::1", "fe80::1", "::ffff:192.168.1.2"])(
        "treats %s as private",
        (ip) => expect(isPrivateIp(ip)).toBe(true),
    );
    it.each(["8.8.8.8", "172.32.0.1", "81.2.69.160", "2001:db8::1"])("treats %s as public", (ip) =>
        expect(isPrivateIp(ip)).toBe(false),
    );
});

describe("getSharedAccountSuspects", () => {
    it("flags overlapping streams from different public IPs", () => {
        insertIdentity("X", "Xavier");
        stream("X", T0, HOUR, "81.2.69.160");
        stream("X", T0 + 10 * MINUTE, HOUR, "5.6.7.8");
        stream("X", T0 + 3 * HOUR, HOUR, "81.2.69.160");
        stream("X", T0 + 3 * HOUR + MINUTE * 5, HOUR, "9.9.9.9");

        expect(suspects()).toEqual([
            {
                accountId: "X",
                user: "Xavier",
                thumb: null,
                incidents: 2,
                distinctIps: 3,
                lastOccurrence: T0 + 3 * HOUR + MINUTE * 5,
            },
        ]);
    });

    it("ignores hand-offs shorter than MIN_OVERLAP_MS, same-IP pairs and LAN households", () => {
        // Hand-off: new device starts just before the old session ends.
        stream("H", T0, HOUR, "81.2.69.160");
        stream("H", T0 + HOUR - (MIN_OVERLAP_MS - MINUTE), HOUR, "5.6.7.8");
        // Same public IP: household behind one NAT.
        stream("S", T0, HOUR, "81.2.69.160");
        stream("S", T0 + MINUTE * 5, HOUR, "81.2.69.160");
        // Two LAN devices with their own private addresses.
        stream("L", T0, HOUR, "192.168.1.10", "lan");
        stream("L", T0 + MINUTE * 5, HOUR, "192.168.1.11", "lan");

        expect(suspects()).toEqual([]);
    });

    it("counts a LAN stream overlapping a remote WAN stream", () => {
        stream("M", T0, HOUR, "192.168.1.10", "lan");
        stream("M", T0 + MINUTE * 5, HOUR, "81.2.69.160", "wan");
        expect(suspects()).toMatchObject([{ accountId: "M", incidents: 1, distinctIps: 2 }]);
    });

    it("ranks by incidents and honours limit, server filter and scope", () => {
        stream("A", T0, HOUR, "1.1.1.1");
        stream("A", T0 + MINUTE * 5, HOUR, "2.2.2.2", "wan", "srv-b");
        stream("B", T0, HOUR, "1.1.1.1");
        stream("B", T0 + MINUTE * 5, HOUR, "2.2.2.2");
        stream("B", T0 + MINUTE * 10, HOUR, "3.3.3.3");

        expect(suspects().map((s) => [s.accountId, s.incidents])).toEqual([["B", 3], ["A", 1]]);
        expect(suspects({ limit: 1 }).map((s) => s.accountId)).toEqual(["B"]);
        // A's streams only overlap across servers — a single-server view cannot see it.
        expect(suspects({ serverId: "srv-a" }).map((s) => s.accountId)).toEqual(["B"]);
        expect(suspects({ allowedServerIds: ["srv-b"] })).toEqual([]);
    });

    it("skips rows without an IP and streams outside the window", () => {
        insertPlay({ userId: "N", startTime: T0, stopTime: T0 + HOUR, ip: null });
        stream("N", T0 + MINUTE, HOUR, "1.1.1.1");
        stream("O", SINCE - HOUR, 2 * HOUR, "1.1.1.1");
        stream("O", SINCE - MINUTE * 30, HOUR, "2.2.2.2");
        expect(suspects()).toEqual([]);
    });
});
