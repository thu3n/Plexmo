/**
 * Shared between the service worker and DOM clients (the About page's SW status
 * panel) — message types and payload shapes only, no runtime dependencies.
 */
export const SW_INFO_MESSAGE_TYPE = "SW_INFO";

/** Bump on every service-worker-affecting change — grep-able in the built
 * public/sw.js and shown in Settings → About for on-device verification. */
export const SW_VERSION = "2026-07-23-shell-swr-1";

export interface SwInfoPayload {
    version: string;
    pagesCacheKeys: string[];
}
