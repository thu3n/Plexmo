import { describe, it, expect } from "vitest";
import { groupUsers } from "@/features/users/lib/groupUsers";
import type { DirectoryUserRow } from "@/features/users/types";

const row = (overrides: Partial<DirectoryUserRow>): DirectoryUserRow => ({
    id: "100",
    title: "Elias",
    username: "elias",
    email: "elias@example.com",
    thumb: "",
    serverId: "srv-a",
    serverName: "Alpha",
    ...overrides,
});

describe("groupUsers", () => {
    it("collapses memberships on two servers into one identity with both badges", () => {
        const users = groupUsers([
            row({ serverId: "srv-a", serverName: "Alpha" }),
            row({ serverId: "srv-b", serverName: "Beta" }),
        ]);
        expect(users).toHaveLength(1);
        expect(users[0].accountId).toBe("100");
        expect(users[0].servers.map((s) => s.serverId)).toEqual(["srv-a", "srv-b"]);
    });

    it("keeps distinct identities apart", () => {
        const users = groupUsers([
            row({}),
            row({ id: "200", title: "Frank", username: "frank" }),
        ]);
        expect(users).toHaveLength(2);
    });

    it("isAdmin/isImported are true if ANY membership has them", () => {
        const users = groupUsers([
            row({ isAdmin: false, isImported: true }),
            row({ serverId: "srv-b", serverName: "Beta", isAdmin: true, isImported: false }),
        ]);
        expect(users[0].isAdmin).toBe(true);
        expect(users[0].isImported).toBe(true);
    });

    it("prefers a row that has a thumb", () => {
        const users = groupUsers([
            row({ thumb: "" }),
            row({ serverId: "srv-b", serverName: "Beta", thumb: "/thumb/elias" }),
        ]);
        expect(users[0].thumb).toBe("/thumb/elias");
    });

    it("does not duplicate the same server membership", () => {
        const users = groupUsers([row({}), row({})]);
        expect(users[0].servers).toHaveLength(1);
    });
});
