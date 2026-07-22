/// <reference lib="webworker" />
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

import { handleNavigation } from "@/lib/sw/navigation";
import { buildSwInfo, warmPagesCache } from "@/lib/sw/lifecycle";
import { SW_INFO_MESSAGE_TYPE } from "@/lib/sw/protocol";

const POSTER_CACHE_MAX_ENTRIES = 300;
const POSTER_CACHE_MAX_AGE_SECONDS = 7 * 24 * 3600;

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Serwist injects the build manifest (hashed JS/CSS/shell) at this point.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Top-level navigations — see src/lib/sw/navigation.ts for the strategy split
    // ("/" instant-from-cache with background refresh, other pages NetworkFirst)
    // and the redirect guards that keep iOS standalone mode intact. Must stay
    // FIRST — runtimeCaching matches in array order.
    {
      matcher: ({ sameOrigin, request, url }) =>
        sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/"),
      handler: handleNavigation,
    },
    // Poster/art bytes from the authenticated image proxy. Subresource images
    // ONLY — this is NOT a navigation route and can never hand a redirect to a
    // top-level navigation. Must stay ABOVE the generic /api/ NetworkOnly route.
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/image"),
      handler: new StaleWhileRevalidate({
        cacheName: "poster-art",
        plugins: [
          new ExpirationPlugin({
            maxEntries: POSTER_CACHE_MAX_ENTRIES,
            maxAgeSeconds: POSTER_CACHE_MAX_AGE_SECONDS,
          }),
        ],
      }),
    },
    // Live monitoring data must NEVER be served stale. Always hit the network so the
    // server-side dashboard cache (the one thing keeping "now playing" fresh for all
    // clients) is the single source of truth. Offline is allowed to fail by design.
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // Build output is content-hashed and immutable — cache aggressively for instant loads.
    {
      matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({ cacheName: "next-static" }),
    },
    // Static images (icons, media flags, library art) rarely change — serve from cache,
    // refresh in the background.
    {
      matcher: ({ url }) => url.pathname.startsWith("/images/"),
      handler: new StaleWhileRevalidate({ cacheName: "static-images" }),
    },
  ],
});

// Custom listeners must be registered BEFORE serwist.addEventListeners().
self.addEventListener("activate", (event) => {
  event.waitUntil(warmPagesCache());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== SW_INFO_MESSAGE_TYPE) return;
  event.waitUntil(buildSwInfo().then((payload) => event.ports[0]?.postMessage(payload)));
});

serwist.addEventListeners();
