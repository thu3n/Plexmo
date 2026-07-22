/// <reference lib="webworker" />
import {
    copyResponse,
    ExpirationPlugin,
    NetworkFirst,
    StaleWhileRevalidate,
    type RouteHandlerCallbackOptions,
} from "serwist";

export const PAGES_CACHE = "pages";
const PAGES_CACHE_MAX_ENTRIES = 16;
// Non-shell navigations: how long a cold open may wait on the network before
// painting the cached page instead.
const NAVIGATION_NETWORK_TIMEOUT_SECONDS = 2;
export const ROOT_SHELL_PATH = "/";

// History: an earlier NetworkFirst navigation route handed the "/" -> /login 307's
// *redirected* Response back to top-level navigations, which kicks iOS installed PWAs
// out of standalone mode into the in-app browser. The navigation path closes that hole
// in BOTH directions: cacheWillUpdate refuses to store redirected/non-200 responses,
// and handleNavigation re-wraps any live redirected response via copyResponse
// (rebuilds the Response, so `redirected` is false) before returning it.
const neverCacheRedirects = {
    cacheWillUpdate: async ({ response }: { response: Response }) =>
        response.redirected || response.status !== 200 ? null : response,
};

// Start-url "/" is a prerendered client shell (data arrives via SWR after
// hydration), so serving the cached copy INSTANTLY and refreshing it in the
// background is semantically safe — this is what removes the white window on
// iOS cold opens, where nothing paints until the document arrives.
const rootShellStrategy = new StaleWhileRevalidate({
    cacheName: PAGES_CACHE,
    plugins: [new ExpirationPlugin({ maxEntries: PAGES_CACHE_MAX_ENTRIES }), neverCacheRedirects],
});

const otherPagesStrategy = new NetworkFirst({
    cacheName: PAGES_CACHE,
    networkTimeoutSeconds: NAVIGATION_NETWORK_TIMEOUT_SECONDS,
    plugins: [new ExpirationPlugin({ maxEntries: PAGES_CACHE_MAX_ENTRIES }), neverCacheRedirects],
});

/** Guard used for both runtime caching and the activate-time shell warmup:
 * only a 200, non-redirected response whose final URL is the shell itself may
 * ever enter the pages cache (an unauthenticated "/" 307s to /login and an
 * unconfigured install 307s to /setup — both are refused). */
export const isCacheableShellResponse = (response: {
    ok: boolean;
    redirected: boolean;
    url: string;
}): boolean =>
    response.ok && !response.redirected && new URL(response.url).pathname === ROOT_SHELL_PATH;

export const handleNavigation = async (options: RouteHandlerCallbackOptions): Promise<Response> => {
    const strategy = options.url.pathname === ROOT_SHELL_PATH ? rootShellStrategy : otherPagesStrategy;
    const [responsePromise, done] = strategy.handleAll(options);
    // Tie the strategy's background cache.put (of the still-streaming clone) to
    // the event lifetime explicitly — iOS terminates the SW aggressively after
    // respondWith settles, and a swallowed rejection would hide put failures.
    options.event.waitUntil(done);
    const response = await responsePromise;
    return response.redirected ? await copyResponse(response) : response;
};
