import { describe, it, expect } from "vitest";
import {
    activityFor,
    filterUsers,
    INACTIVE_AFTER_DAYS,
    parseSort,
    serializeSort,
    sortUsers,
    DEFAULT_SORT,
    type DirectoryFilters,
} from "../lib/directory-query";
import { formatLastSeen } from "../lib/format-activity";
import type { DirectoryMembership, DirectoryUser } from "../types";

const NOW = 1_790_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const membership = (overrides: Partial<DirectoryMembership> = {}): DirectoryMembership => ({
    serverId: "srv-a",
    serverName: "Alpha",
    plays: 0,
    watchSeconds: 0,
    lastPlayedAt: null,
    ...overrides,
});

const user = (title: string, servers: DirectoryMembership[], overrides: Partial<DirectoryUser> = {}): DirectoryUser => ({
    accountId: title,
    title,
    username: title.toLowerCase(),
    email: "",
    thumb: null,
    isAdmin: false,
    servers,
    ...overrides,
});

const filters = (overrides: Partial<DirectoryFilters> = {}): DirectoryFilters => ({
    search: "",
    serverId: "",
    adminOnly: false,
    inactiveOnly: false,
    ...overrides,
});

const alice = user("Alice", [
    membership({ plays: 10, watchSeconds: 3600, lastPlayedAt: NOW - DAY }),
    membership({ serverId: "srv-b", serverName: "Beta", plays: 5, watchSeconds: 7200, lastPlayedAt: NOW - 2 * DAY }),
]);
const bob = user("Bob", [membership({ plays: 20, watchSeconds: 1800, lastPlayedAt: NOW - 40 * DAY })], { isAdmin: true });
const carol = user("Carol", [membership({ serverId: "srv-b", serverName: "Beta" })]);
const all = [carol, bob, alice];

const titles = (list: DirectoryUser[]) => list.map((u) => u.title);

describe("activityFor", () => {
    it("sums every membership when no server is selected", () => {
        expect(activityFor(alice, "")).toEqual({ plays: 15, watchSeconds: 10800, lastPlayedAt: NOW - DAY });
    });

    it("only counts the selected server", () => {
        expect(activityFor(alice, "srv-b")).toEqual({ plays: 5, watchSeconds: 7200, lastPlayedAt: NOW - 2 * DAY });
    });

    it("is empty for a user who never played", () => {
        expect(activityFor(carol, "")).toEqual({ plays: 0, watchSeconds: 0, lastPlayedAt: null });
    });
});

describe("sortUsers", () => {
    it("sorts by name both ways", () => {
        expect(titles(sortUsers(all, { key: "name", dir: "asc" }, ""))).toEqual(["Alice", "Bob", "Carol"]);
        expect(titles(sortUsers(all, { key: "name", dir: "desc" }, ""))).toEqual(["Carol", "Bob", "Alice"]);
    });

    it("sorts by plays, ties broken by name", () => {
        expect(titles(sortUsers(all, { key: "plays", dir: "desc" }, ""))).toEqual(["Bob", "Alice", "Carol"]);
        expect(titles(sortUsers(all, { key: "plays", dir: "asc" }, ""))).toEqual(["Carol", "Alice", "Bob"]);
    });

    it("sorts by watch time", () => {
        expect(titles(sortUsers(all, { key: "watchTime", dir: "desc" }, ""))).toEqual(["Alice", "Bob", "Carol"]);
    });

    it("aggregates only the filtered server", () => {
        // Across both servers Alice has 15 plays; on srv-b alone she has 5.
        const bobOnB = user("Bob", [membership({ serverId: "srv-b", serverName: "Beta", plays: 8 })]);
        expect(titles(sortUsers([alice, bobOnB], { key: "plays", dir: "desc" }, ""))).toEqual(["Alice", "Bob"]);
        expect(titles(sortUsers([alice, bobOnB], { key: "plays", dir: "desc" }, "srv-b"))).toEqual(["Bob", "Alice"]);
    });

    it("keeps never-seen users last in either direction", () => {
        expect(titles(sortUsers(all, { key: "lastSeen", dir: "desc" }, ""))).toEqual(["Alice", "Bob", "Carol"]);
        expect(titles(sortUsers(all, { key: "lastSeen", dir: "asc" }, ""))).toEqual(["Bob", "Alice", "Carol"]);
    });

    it("does not mutate the input", () => {
        const input = [...all];
        sortUsers(input, { key: "name", dir: "asc" }, "");
        expect(input).toEqual(all);
    });
});

describe("filterUsers", () => {
    it("matches search on title or username, case-insensitive and trimmed", () => {
        expect(titles(filterUsers(all, filters({ search: "  ALI " }), NOW))).toEqual(["Alice"]);
    });

    it("filters by server membership", () => {
        expect(titles(filterUsers(all, filters({ serverId: "srv-b" }), NOW))).toEqual(["Carol", "Alice"]);
    });

    it("filters admin", () => {
        expect(titles(filterUsers(all, filters({ adminOnly: true }), NOW))).toEqual(["Bob"]);
    });

    it(`treats no play in ${INACTIVE_AFTER_DAYS} days (or never) as inactive`, () => {
        expect(titles(filterUsers(all, filters({ inactiveOnly: true }), NOW))).toEqual(["Carol", "Bob"]);
    });

    it("judges inactivity per selected server", () => {
        const dave = user("Dave", [
            membership({ lastPlayedAt: NOW - DAY }),
            membership({ serverId: "srv-b", serverName: "Beta", lastPlayedAt: NOW - 90 * DAY }),
        ]);
        expect(filterUsers([dave], filters({ inactiveOnly: true }), NOW)).toHaveLength(0);
        expect(filterUsers([dave], filters({ inactiveOnly: true, serverId: "srv-b" }), NOW)).toHaveLength(1);
    });
});

describe("parseSort / serializeSort", () => {
    it("round-trips", () => {
        expect(parseSort(serializeSort({ key: "watchTime", dir: "desc" }))).toEqual({ key: "watchTime", dir: "desc" });
    });

    it("falls back to the default for empty or unknown values", () => {
        expect(parseSort("")).toEqual(DEFAULT_SORT);
        expect(parseSort("bogus:asc")).toEqual(DEFAULT_SORT);
        expect(parseSort("plays:sideways")).toEqual(DEFAULT_SORT);
    });
});

describe("formatLastSeen", () => {
    it("formats relative ages", () => {
        expect(formatLastSeen(null, NOW)).toBe("Never");
        expect(formatLastSeen(NOW - 5 * 60 * 1000, NOW)).toBe("Just now");
        expect(formatLastSeen(NOW - 3 * 60 * 60 * 1000, NOW)).toBe("3h ago");
        expect(formatLastSeen(NOW - 4 * DAY, NOW)).toBe("4d ago");
        expect(formatLastSeen(NOW - 65 * DAY, NOW)).toBe("2mo ago");
        expect(formatLastSeen(NOW - 800 * DAY, NOW)).toBe("2y ago");
    });
});
