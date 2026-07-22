// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPLE_STARTUP_IMAGES, SPLASH_SIZES } from "@/lib/pwa-splash";

// Guards against drift between src/lib/pwa-splash.ts (the <link> tags) and
// scripts/generate-splash.mjs (the committed PNGs in public/splash/).
describe("iOS splash assets", () => {
    it("has a committed PNG for every startup-image entry", () => {
        for (const image of APPLE_STARTUP_IMAGES) {
            const file = path.join(process.cwd(), "public", image.url);
            expect(existsSync(file), `${image.url} missing — run npm run generate:splash`).toBe(true);
        }
    });

    it("declares one entry per size with unique media queries and URLs", () => {
        expect(APPLE_STARTUP_IMAGES).toHaveLength(SPLASH_SIZES.length);
        expect(new Set(APPLE_STARTUP_IMAGES.map((i) => i.media)).size).toBe(SPLASH_SIZES.length);
        expect(new Set(APPLE_STARTUP_IMAGES.map((i) => i.url)).size).toBe(SPLASH_SIZES.length);
    });

    it("targets portrait with device-width/height and pixel-ratio", () => {
        for (const image of APPLE_STARTUP_IMAGES) {
            expect(image.media).toMatch(/device-width: \d+px/);
            expect(image.media).toMatch(/-webkit-device-pixel-ratio: [23]/);
            expect(image.media).toMatch(/orientation: portrait/);
        }
    });
});
