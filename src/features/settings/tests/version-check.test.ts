import { describe, expect, it } from "vitest";
import { compareSemver, isNewerVersion, parseSemver } from "@/lib/semver";
import { parseReleasePayload, repoSlugFromUrl } from "@/lib/update-check";

describe("semver", () => {
    it("parses with or without a v prefix", () => {
        expect(parseSemver("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null });
        expect(parseSemver("1.2.3-beta.1+build.5")).toEqual({ major: 1, minor: 2, patch: 3, prerelease: "beta.1" });
        expect(parseSemver("1.2")).toBeNull();
        expect(parseSemver("latest")).toBeNull();
    });

    it("compares numerically, not lexically", () => {
        expect(compareSemver("1.10.0", "1.9.9")).toBe(1);
        expect(compareSemver("1.2.2", "1.2.10")).toBe(-1);
        expect(compareSemver("v2.0.0", "2.0.0")).toBe(0);
    });

    it("ranks releases above their prereleases", () => {
        expect(compareSemver("1.3.0", "1.3.0-rc.1")).toBe(1);
        expect(compareSemver("1.3.0-rc.2", "1.3.0-rc.10")).toBe(-1);
        expect(compareSemver("1.3.0-alpha", "1.3.0-beta")).toBe(-1);
    });

    it("isNewerVersion is strict and false for non-SemVer input", () => {
        expect(isNewerVersion("1.2.3", "1.2.2")).toBe(true);
        expect(isNewerVersion("1.2.2", "1.2.2")).toBe(false);
        expect(isNewerVersion("1.2.1", "1.2.2")).toBe(false);
        expect(isNewerVersion("nightly", "1.2.2")).toBe(false);
    });
});

describe("update check parsing", () => {
    it("extracts owner/repo from GitHub URLs only", () => {
        expect(repoSlugFromUrl("https://github.com/thu3n/plexmo.git")).toBe("thu3n/plexmo");
        expect(repoSlugFromUrl("git+https://github.com/thu3n/plexmo")).toBe("thu3n/plexmo");
        expect(repoSlugFromUrl("https://evil.example/thu3n/plexmo")).toBeNull();
    });

    it("validates the GitHub release payload", () => {
        const url = "https://github.com/thu3n/plexmo/releases/tag/v1.4.0";
        expect(parseReleasePayload({ tag_name: "v1.4.0", html_url: url, published_at: "2026-09-01T00:00:00Z" })).toEqual({
            version: "1.4.0",
            url,
            publishedAt: "2026-09-01T00:00:00Z",
        });
        expect(parseReleasePayload({ tag_name: "v1.4.0", html_url: "javascript:void(0)" })).toBeNull();
        expect(parseReleasePayload({ tag_name: "nightly", html_url: "https://github.com/x/y" })).toBeNull();
        expect(parseReleasePayload(null)).toBeNull();
    });
});
