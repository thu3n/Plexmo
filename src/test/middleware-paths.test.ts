import { describe, it, expect } from "vitest";

import { isPublicPath, isStaticAssetPath } from "@/lib/middleware-paths";

describe("isStaticAssetPath", () => {
    it("never treats an API route as a static asset", () => {
        // Regression: a dot in a dynamic segment used to skip all auth.
        expect(isStaticAssetPath("/api/rules/instances/5.")).toBe(false);
        expect(isStaticAssetPath("/api/users/foo.bar/rules")).toBe(false);
        expect(isStaticAssetPath("/api/settings")).toBe(false);
        expect(isStaticAssetPath("/api/history/export/x.json")).toBe(false);
    });

    it("passes through the dotted routes the PWA depends on", () => {
        expect(isStaticAssetPath("/manifest.webmanifest")).toBe(true);
        expect(isStaticAssetPath("/sw.js")).toBe(true);
        expect(isStaticAssetPath("/icon.png")).toBe(true);
        expect(isStaticAssetPath("/apple-icon.png")).toBe(true);
        expect(isStaticAssetPath("/favicon.ico")).toBe(true);
    });

    it("passes through public/ assets and Next internals", () => {
        expect(isStaticAssetPath("/noise.svg")).toBe(true);
        expect(isStaticAssetPath("/icons/icon-192.png")).toBe(true);
        expect(isStaticAssetPath("/splash/iphone.png")).toBe(true);
        expect(isStaticAssetPath("/images/library/movie.svg")).toBe(true);
        expect(isStaticAssetPath("/_next/static/chunk.js")).toBe(true);
    });

    it("does not exempt ordinary pages", () => {
        expect(isStaticAssetPath("/")).toBe(false);
        expect(isStaticAssetPath("/settings/general")).toBe(false);
    });
});

describe("isPublicPath", () => {
    it("allows the self-guarding API surface", () => {
        expect(isPublicPath("/api/auth/me")).toBe(true);
        expect(isPublicPath("/api/auth/plex")).toBe(true);
        expect(isPublicPath("/api/setup/status")).toBe(true);
        expect(isPublicPath("/api/invites/validate")).toBe(true);
        expect(isPublicPath("/api/history")).toBe(true);
        expect(isPublicPath("/api/history/export")).toBe(true);
        expect(isPublicPath("/api/stats/home")).toBe(true);
        expect(isPublicPath("/api/stats/overview/summary")).toBe(true);
    });

    it("matches API paths exactly, not by prefix", () => {
        // Regression: prefix matching made these public.
        expect(isPublicPath("/api/historyEVIL")).toBe(false);
        expect(isPublicPath("/api/statsFAKE")).toBe(false);
        expect(isPublicPath("/api/auth/plexEVIL")).toBe(false);
        expect(isPublicPath("/api/history/export/debug-fetch")).toBe(false);
        expect(isPublicPath("/api/stats/overview")).toBe(false);
    });

    it("matches public pages per segment", () => {
        expect(isPublicPath("/login")).toBe(true);
        expect(isPublicPath("/setup")).toBe(true);
        expect(isPublicPath("/invite")).toBe(true);
        expect(isPublicPath("/invite/abc123")).toBe(true);
        expect(isPublicPath("/invite/continue")).toBe(true);
        expect(isPublicPath("/loginEVIL")).toBe(false);
        expect(isPublicPath("/setupEVIL")).toBe(false);
    });

    it("keeps protected routes protected", () => {
        expect(isPublicPath("/")).toBe(false);
        expect(isPublicPath("/api/settings")).toBe(false);
        expect(isPublicPath("/api/rules/instances")).toBe(false);
        expect(isPublicPath("/api/servers")).toBe(false);
    });
});
