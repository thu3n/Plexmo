import { describe, it, expect } from "vitest";

/**
 * Mirrors the allowlist in src/app/api/image/route.ts. Kept as a copy on
 * purpose: importing the route pulls in the DB layer, and the point of the
 * test is that the *shape* of the accepted paths stays this narrow.
 */
const PMS_IMAGE_PATH = /^\/library\/(metadata|sections)\/[^/]+\/(thumb|art|banner|theme|composite)(\/[^/]+)?$/;
const isAllowed = (p: string) => PMS_IMAGE_PATH.test(p) && !p.includes("..");

describe("/api/image relative path allowlist", () => {
    it("accepts the thumb shapes Plexmo actually stores", () => {
        // library_items.thumb / session.thumb, straight from PMS
        expect(isAllowed("/library/metadata/1064/thumb/1700000000")).toBe(true);
        // synthesized in src/lib/stats/media-thumbs.ts
        expect(isAllowed("/library/metadata/1064/thumb")).toBe(true);
        expect(isAllowed("/library/metadata/1064/art/1700000000")).toBe(true);
        expect(isAllowed("/library/sections/3/composite/1700000000")).toBe(true);
    });

    it("rejects privileged PMS endpoints reachable with the admin token", () => {
        expect(isAllowed("/accounts")).toBe(false);
        expect(isAllowed("/status/sessions")).toBe(false);
        expect(isAllowed("/:/prefs")).toBe(false);
        expect(isAllowed("/myplex/account")).toBe(false);
    });

    it("rejects the library listing, which a bare /library/ prefix would admit", () => {
        expect(isAllowed("/library/sections/1/all")).toBe(false);
        expect(isAllowed("/library/sections")).toBe(false);
        expect(isAllowed("/library/metadata/1064")).toBe(false);
    });

    it("rejects traversal and query smuggling", () => {
        expect(isAllowed("/library/metadata/../../accounts/thumb")).toBe(false);
        expect(isAllowed("/library/metadata/1/thumb?X-Plex-Token=x")).toBe(false);
        expect(isAllowed("/library/metadata/1/thumb#frag")).toBe(false);
        expect(isAllowed("//evil.example/library/metadata/1/thumb")).toBe(false);
    });
});
