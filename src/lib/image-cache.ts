import { createHash } from "node:crypto";

/**
 * In-memory LRU byte cache for the /api/image proxy. Poster art rarely changes,
 * but every request used to re-fetch the full-size original from Plex and pay a
 * synchronous getServerById DB read — on the statistics page that is dozens of
 * fetches competing with the stats queries for the single event loop.
 */

export const IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const IMAGE_CACHE_MAX_BYTES = 50 * 1024 * 1024;
const IMAGE_CACHE_MAX_ENTRIES = 500;
const ETAG_HEX_LENGTH = 16;

export type CachedImage = {
    bytes: Buffer;
    contentType: string;
    etag: string;
    cachedAt: number;
};

const globalAny = globalThis as unknown as {
    __plexmo_image_cache?: Map<string, CachedImage>;
};
const cache: Map<string, CachedImage> = globalAny.__plexmo_image_cache ?? new Map();
globalAny.__plexmo_image_cache = cache;

let totalBytes = [...cache.values()].reduce((sum, entry) => sum + entry.bytes.length, 0);

export const imageCacheKey = (serverId: string, path: string, w?: number, h?: number): string =>
    `${serverId}|${path}|${w ?? 0}x${h ?? 0}`;

export const makeImageEtag = (bytes: Buffer): string =>
    `"${createHash("sha1").update(bytes).digest("hex").slice(0, ETAG_HEX_LENGTH)}"`;

export function getCachedImage(key: string): CachedImage | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt >= IMAGE_CACHE_TTL_MS) {
        cache.delete(key);
        totalBytes -= entry.bytes.length;
        return undefined;
    }
    // delete+set keeps Map insertion order = recency order for eviction.
    cache.delete(key);
    cache.set(key, entry);
    return entry;
}

export function setCachedImage(key: string, image: Omit<CachedImage, "cachedAt">): void {
    if (image.bytes.length > IMAGE_CACHE_MAX_BYTES) return;
    const existing = cache.get(key);
    if (existing) {
        cache.delete(key);
        totalBytes -= existing.bytes.length;
    }
    cache.set(key, { ...image, cachedAt: Date.now() });
    totalBytes += image.bytes.length;
    while ((totalBytes > IMAGE_CACHE_MAX_BYTES || cache.size > IMAGE_CACHE_MAX_ENTRIES) && cache.size > 0) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) break;
        const oldest = cache.get(oldestKey);
        cache.delete(oldestKey);
        totalBytes -= oldest?.bytes.length ?? 0;
    }
}

export function clearImageCache(): void {
    cache.clear();
    totalBytes = 0;
}
