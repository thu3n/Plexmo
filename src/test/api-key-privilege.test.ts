import { describe, it, expect } from "vitest";
import { isOwnerLike, type AccessScope } from "@/lib/authz";

const scope = (role: AccessScope["role"]): { scope: AccessScope } => ({
    scope: { role, serverIds: "all" },
});

describe("isOwnerLike", () => {
    it("admits owners and first-run setup sessions", () => {
        expect(isOwnerLike(scope("owner"))).toBe(true);
        expect(isOwnerLike(scope("setup"))).toBe(true);
    });

    it("rejects API keys — they are read-only", () => {
        // A key travels in query strings for Wrapperr compatibility and lands
        // in proxy access logs. If it were owner-like, that log line would be
        // enough to pull /api/settings/export: every Plex token plus the JWT
        // secret in cleartext.
        expect(isOwnerLike(scope("api"))).toBe(false);
    });

    it("rejects viewers and onboarding sessions", () => {
        expect(isOwnerLike(scope("viewer"))).toBe(false);
        expect(isOwnerLike(scope("onboarding"))).toBe(false);
    });
});
