/// <reference lib="webworker" />
import { SW_VERSION, type SwInfoPayload } from "./protocol";
import { isCacheableShellResponse, PAGES_CACHE, ROOT_SHELL_PATH } from "./navigation";

/**
 * Warm the shell cache on activate: covers the very first cold open after
 * install (the SW installs during the pre-install browsing session) and
 * refreshes the shell the moment each new SW version takes over. Worker-context
 * fetch sends cookies (same-origin default) and follows redirects, so the
 * isCacheableShellResponse guard rejects logged-out (307 -> /login) and
 * unconfigured (307 -> /setup) results — the cache can never be poisoned.
 */
export async function warmPagesCache(): Promise<void> {
    try {
        const response = await fetch(ROOT_SHELL_PATH);
        if (!isCacheableShellResponse(response)) return;
        const cache = await caches.open(PAGES_CACHE);
        await cache.put(ROOT_SHELL_PATH, response);
    } catch {
        // Offline/unreachable at activate time — the navigation route will
        // populate the cache on the next successful open instead.
    }
}

/** Payload for the Settings → About panel's SW_INFO round-trip. */
export async function buildSwInfo(): Promise<SwInfoPayload> {
    const cache = await caches.open(PAGES_CACHE);
    const keys = await cache.keys();
    return {
        version: SW_VERSION,
        pagesCacheKeys: keys.map((request) => new URL(request.url).pathname),
    };
}
