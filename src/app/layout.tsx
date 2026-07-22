import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { LanguageProvider } from "@/components/LanguageContext";
import { GlobalDock } from "@/components/GlobalDock";
import { SessionGuard } from "@/components/SessionGuard";
import { APP_BACKGROUND_COLOR } from "@/lib/theme";
import { APPLE_STARTUP_IMAGES } from "@/lib/pwa-splash";

// Matches globals.css --background (#05070f) so the standalone PWA status bar / splash
// blend with the app instead of flashing white. viewportFit "cover" enables the
// env(safe-area-inset-*) values used by bottom-anchored UI on notched phones.
export const viewport: Viewport = {
  themeColor: APP_BACKGROUND_COLOR,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function buildMetadata(appName: string): Metadata {
  return {
    title: appName,
    description: "Modern live-översikt för din Plex-server",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: appName,
      // iOS ignores manifest background_color — without exact-size startup images the
      // standalone launch screen is white.
      startupImage: APPLE_STARTUP_IMAGES,
    },
    // Next 16 only emits <meta name="mobile-web-app-capable"> from appleWebApp.capable
    // (vercel/next.js#70272); older iOS standalone detection needs the apple- prefixed
    // variant, so emit it explicitly.
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { getSetting } = await import("@/lib/settings");
    return buildMetadata(getSetting("APP_NAME") || "Plexmo");
  } catch {
    return buildMetadata("Plexmo");
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={{ backgroundColor: APP_BACKGROUND_COLOR }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>
          {children}
          <GlobalDock />
          <SessionGuard />
        </LanguageProvider>
      </body>
    </html>
  );
}
