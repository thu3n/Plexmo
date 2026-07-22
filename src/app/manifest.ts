import type { MetadataRoute } from "next";

import { getSetting } from "@/lib/settings";
// Used for the splash/background and the themed status bar so the standalone app
// doesn't flash white on launch.
import { APP_BACKGROUND_COLOR } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  let appName = "Plexmo";
  try {
    appName = getSetting("APP_NAME") || "Plexmo";
  } catch {
    // Settings DB may be unavailable during build/cold start — fall back to the default name.
  }

  return {
    name: appName,
    short_name: appName,
    description: "Modern live-översikt för din Plex-server",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: APP_BACKGROUND_COLOR,
    theme_color: APP_BACKGROUND_COLOR,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
