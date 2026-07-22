// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    IMAGE_CACHE_TTL_MS,
    clearImageCache,
    getCachedImage,
    imageCacheKey,
    makeImageEtag,
    setCachedImage,
} from "@/lib/image-cache";

const image = (size: number, fill = 0xab) => {
    const bytes = Buffer.alloc(size, fill);
    return { bytes, contentType: "image/jpeg", etag: makeImageEtag(bytes) };
};

describe("image cache", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearImageCache();
    });
    afterEach(() => {
        vi.useRealTimers();
        clearImageCache();
    });

    it("stores and returns entries, expiring them after the TTL", () => {
        setCachedImage("k", image(100));
        expect(getCachedImage("k")?.bytes.length).toBe(100);
        vi.advanceTimersByTime(IMAGE_CACHE_TTL_MS + 1);
        expect(getCachedImage("k")).toBeUndefined();
    });

    it("evicts the oldest entries when the byte cap is exceeded", () => {
        // 3 entries of 20MB fit under 50MB only two at a time.
        const twentyMb = 20 * 1024 * 1024;
        setCachedImage("a", image(twentyMb, 1));
        setCachedImage("b", image(twentyMb, 2));
        setCachedImage("c", image(twentyMb, 3));
        expect(getCachedImage("a")).toBeUndefined();
        expect(getCachedImage("b")).toBeDefined();
        expect(getCachedImage("c")).toBeDefined();
    });

    it("refuses to store a single entry larger than the byte cap", () => {
        setCachedImage("huge", image(51 * 1024 * 1024));
        expect(getCachedImage("huge")).toBeUndefined();
    });

    it("evicts past the entry cap", () => {
        for (let i = 0; i < 505; i++) {
            setCachedImage(`k-${i}`, image(10, i % 256));
        }
        expect(getCachedImage("k-0")).toBeUndefined();
        expect(getCachedImage("k-504")).toBeDefined();
    });

    it("treats a re-read entry as recently used", () => {
        const twentyMb = 20 * 1024 * 1024;
        setCachedImage("a", image(twentyMb, 1));
        setCachedImage("b", image(twentyMb, 2));
        getCachedImage("a"); // touch a -> b becomes the eviction candidate
        setCachedImage("c", image(twentyMb, 3));
        expect(getCachedImage("a")).toBeDefined();
        expect(getCachedImage("b")).toBeUndefined();
    });
});

describe("makeImageEtag", () => {
    it("is a quoted 16-hex digest, stable for identical bytes", () => {
        const a = makeImageEtag(Buffer.from("poster"));
        expect(a).toMatch(/^"[0-9a-f]{16}"$/);
        expect(makeImageEtag(Buffer.from("poster"))).toBe(a);
        expect(makeImageEtag(Buffer.from("other"))).not.toBe(a);
    });
});

describe("imageCacheKey", () => {
    it("separates sized and unsized variants", () => {
        expect(imageCacheKey("s", "/p")).toBe("s|/p|0x0");
        expect(imageCacheKey("s", "/p", 90, 135)).toBe("s|/p|90x135");
        expect(imageCacheKey("s", "/p")).not.toBe(imageCacheKey("s", "/p", 90, 135));
    });
});
