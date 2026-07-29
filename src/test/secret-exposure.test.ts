import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Two credentials used to escape through response bodies:
 * - the caller's plex.tv accessToken, via /api/auth/me returning the whole
 *   JWT payload;
 * - the server's Plex admin token, via the image proxy echoing the upstream
 *   URL (which carries ?X-Plex-Token=) in its error text and access log.
 *
 * Both are shaped as source assertions: the leaks were in how the response was
 * built, and neither route is worth booting Next for.
 */

const read = (...segments: string[]): string =>
    readFileSync(resolve(__dirname, "..", ...segments), "utf8");

/** Comments explain why a field is absent, so they must not count as usage. */
const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("/api/auth/me response", () => {
    const source = stripComments(read("app", "api", "auth", "me", "route.ts"));

    it("never hands the plex.tv accessToken to the browser", () => {
        expect(source).not.toContain("accessToken");
    });

    it("returns an explicit field whitelist, not the raw payload", () => {
        expect(source).not.toMatch(/NextResponse\.json\(\{\s*user\s*\}\)/);
        for (const field of ["id:", "username:", "email:", "thumb:", "role:"]) {
            expect(source).toContain(field);
        }
    });
});

describe("image proxies", () => {
    it("the metadata proxy never surfaces the tokenized upstream URL", () => {
        const source = stripComments(read("app", "library", "metadata", "[...path]", "route.ts"));
        // The token is set as a search param; it must not reach a response
        // body or a log line via the assembled URL object.
        expect(source).not.toMatch(/URL:\s*\$\{upstreamUrl\}/);
        expect(source).not.toMatch(/console\.log/);
        expect(source).not.toMatch(/Logger\.\w+\([^)]*upstreamUrl/);
    });

    it("the dead /api/proxy/image route is gone", () => {
        expect(() => read("app", "api", "proxy", "image", "route.ts")).toThrow();
    });
});
