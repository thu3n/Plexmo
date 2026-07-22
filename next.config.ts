import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// NOTE: the JWT secret is deliberately NOT resolved here. next.config's `env`
// block inlines values at BUILD time — CI builds (no JWT_SECRET set) baked a
// fresh random secret into every image, invalidating all sessions on each
// deploy, and runtime `-e JWT_SECRET` was silently ignored. The secret is now
// resolved at runtime in src/lib/jwt-secret.ts (instrumentation.ts).

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: '1024mb',
    },
  },
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      // iOS fetches the apple-touch-startup-image set (and icons) per visit; public/
      // files otherwise ship max-age=0 which makes WebKit revalidate/refetch every
      // reload. Content is near-static — a day of caching + a week of SWR is safe
      // (filenames are stable, so no immutable).
      {
        source: "/splash/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

// PWA: precache the app shell + static assets so mobile loads are instant and the app is
// installable. The service worker (src/app/sw.ts) keeps /api/* network-only — live monitoring
// data is never served stale. Disabled in dev so it doesn't interfere with HMR.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Keep the install/update burst small: media_flags (~6.4MB of per-media badge PNGs)
  // are served on demand by the SW's /images/ StaleWhileRevalidate route, and
  // screenshots are never fetched by the app at runtime. Precaching them competed
  // with the launch navigation for tunnel bandwidth on first open / post-deploy.
  globPublicPatterns: [
    "*.*",
    "icons/**",
    "splash/**",
    "images/*.*",
    "images/!(media_flags)/**",
  ],
});

export default withSerwist(nextConfig);
