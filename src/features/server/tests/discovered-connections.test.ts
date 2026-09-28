import { describe, expect, it } from "vitest";
import { rankDiscoveredConnections } from "../lib/discovered-connections";
import { formatLastSeen } from "../lib/format-last-seen";
import { parseServerColor } from "@/lib/serverColors";

describe("rankDiscoveredConnections", () => {
    const resource = {
        name: "Basement",
        clientIdentifier: "abc",
        productVersion: "1.41",
        token: "tok",
        connections: [
            { uri: "https://relay.plex.direct:8443", local: false, relay: true, protocol: "https" },
            { uri: "http://203.0.113.5:32400", local: 0, relay: 0, protocol: "http" },
            { uri: "https://192-168-1-10.abc.plex.direct:32400", local: "1", protocol: "https" },
            { uri: "http://192.168.1.10:32400", local: true, protocol: "http" },
        ],
    };

    it("orders local > remote > relay, https first within a kind", () => {
        const ranked = rankDiscoveredConnections([resource]);
        expect(ranked.map((c) => [c.kind, c.secure])).toEqual([
            ["local", true],
            ["local", false],
            ["remote", false],
            ["relay", true],
        ]);
    });

    it("flags exactly one best connection per server", () => {
        const ranked = rankDiscoveredConnections([resource, { ...resource, clientIdentifier: "def", name: "Cabin" }]);
        expect(ranked.filter((c) => c.isBest).map((c) => c.resourceId)).toEqual(["abc", "def"]);
        expect(ranked.find((c) => c.isBest)?.uri).toContain("plex.direct");
    });

    it("falls back to accessToken and tolerates missing connections", () => {
        const ranked = rankDiscoveredConnections([
            { name: "x", clientIdentifier: "x", accessToken: "acc", connections: [{ uri: "http://a" }] },
            { name: "y", clientIdentifier: "y" },
        ]);
        expect(ranked).toHaveLength(1);
        expect(ranked[0]).toMatchObject({ token: "acc", kind: "remote" });
    });
});

describe("formatLastSeen", () => {
    const now = Date.parse("2026-09-28T12:00:00Z");
    it("formats compact relative times", () => {
        expect(formatLastSeen(null, now)).toBeNull();
        expect(formatLastSeen("2026-09-28T11:59:50Z", now)).toBe("just now");
        expect(formatLastSeen("2026-09-28T11:55:00Z", now)).toBe("5 min ago");
        expect(formatLastSeen("2026-09-28T09:00:00Z", now)).toBe("3 h ago");
        expect(formatLastSeen("2026-09-26T12:00:00Z", now)).toBe("2 d ago");
    });
});

describe("parseServerColor", () => {
    it("accepts hex, clears on empty, rejects junk", () => {
        expect(parseServerColor("#34d399")).toBe("#34D399");
        expect(parseServerColor("")).toBeNull();
        expect(parseServerColor(null)).toBeNull();
        expect(parseServerColor("red; background:url(x)")).toBeUndefined();
        expect(parseServerColor(undefined)).toBeUndefined();
    });
});
