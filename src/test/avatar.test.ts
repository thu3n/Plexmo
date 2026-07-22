// @vitest-environment node
import { describe, expect, it } from "vitest";
import { avatarSrc, isAllowedExternalImageUrl } from "@/lib/avatar";

describe("isAllowedExternalImageUrl", () => {
    it("allows plex.tv and subdomains over https", () => {
        expect(isAllowedExternalImageUrl("https://plex.tv/users/abc/avatar?c=1")).toBe(true);
        expect(isAllowedExternalImageUrl("https://metadata.plex.tv/x.png")).toBe(true);
    });

    it("rejects lookalike hosts, http, and garbage", () => {
        expect(isAllowedExternalImageUrl("https://plex.tv.evil.com/avatar")).toBe(false);
        expect(isAllowedExternalImageUrl("https://evil.com/plex.tv/avatar")).toBe(false);
        expect(isAllowedExternalImageUrl("http://plex.tv/users/abc/avatar")).toBe(false);
        expect(isAllowedExternalImageUrl("not a url")).toBe(false);
    });
});

describe("avatarSrc", () => {
    it("routes absolute thumbs through the image proxy without serverId", () => {
        expect(avatarSrc("https://plex.tv/users/abc/avatar?c=1", "elias")).toBe(
            `/api/image?path=${encodeURIComponent("https://plex.tv/users/abc/avatar?c=1")}`,
        );
    });

    it("routes relative thumbs through the proxy with serverId", () => {
        expect(avatarSrc("/thumb/1", "elias", "srv-1")).toBe(
            `/api/image?path=${encodeURIComponent("/thumb/1")}&serverId=srv-1`,
        );
    });

    it("falls back to the local initials avatar", () => {
        expect(avatarSrc(null, "elias")).toBe("/api/avatar-fallback?name=elias");
        expect(avatarSrc("/thumb/1", "elias")).toBe("/api/avatar-fallback?name=elias");
        expect(avatarSrc(undefined, "å ä")).toBe(`/api/avatar-fallback?name=${encodeURIComponent("å ä")}`);
    });
});
