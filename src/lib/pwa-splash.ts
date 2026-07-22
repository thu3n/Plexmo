/**
 * iOS launch-screen (apple-touch-startup-image) definitions.
 *
 * iOS ignores the web-app manifest's background_color in standalone mode: without an
 * exact-size startup image per device, the splash is white. Portrait-only set — a
 * landscape launch without a match falls back to the dark first paint from layout.tsx.
 *
 * The size table is mirrored as plain data in scripts/generate-splash.mjs (which renders
 * the PNGs into public/splash/). src/test/pwa-splash.test.ts guards against drift.
 */

type SplashSize = { cssWidth: number; cssHeight: number; dpr: 2 | 3 };

export const SPLASH_SIZES: readonly SplashSize[] = [
  // iPhone
  { cssWidth: 375, cssHeight: 667, dpr: 2 }, // 750x1334  SE 2/3, 8
  { cssWidth: 414, cssHeight: 896, dpr: 2 }, // 828x1792  XR, 11
  { cssWidth: 375, cssHeight: 812, dpr: 3 }, // 1125x2436 X, XS, 11 Pro
  { cssWidth: 414, cssHeight: 896, dpr: 3 }, // 1242x2688 XS Max, 11 Pro Max
  { cssWidth: 360, cssHeight: 780, dpr: 3 }, // 1080x2340 12/13 mini
  { cssWidth: 390, cssHeight: 844, dpr: 3 }, // 1170x2532 12, 13, 14
  { cssWidth: 428, cssHeight: 926, dpr: 3 }, // 1284x2778 12/13 Pro Max, 14 Plus
  { cssWidth: 393, cssHeight: 852, dpr: 3 }, // 1179x2556 14 Pro, 15, 16, 16e
  { cssWidth: 430, cssHeight: 932, dpr: 3 }, // 1290x2796 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { cssWidth: 402, cssHeight: 874, dpr: 3 }, // 1206x2622 16 Pro, 17, 17 Pro
  { cssWidth: 440, cssHeight: 956, dpr: 3 }, // 1320x2868 16 Pro Max, 17 Pro Max
  { cssWidth: 420, cssHeight: 912, dpr: 3 }, // 1260x2736 iPhone Air
  // iPad
  { cssWidth: 768, cssHeight: 1024, dpr: 2 }, // 1536x2048 iPad 9.7 / mini
  { cssWidth: 810, cssHeight: 1080, dpr: 2 }, // 1620x2160 iPad 10.2
  { cssWidth: 820, cssHeight: 1180, dpr: 2 }, // 1640x2360 iPad 10.9 / Air
  { cssWidth: 834, cssHeight: 1194, dpr: 2 }, // 1668x2388 iPad Pro 11
  { cssWidth: 1024, cssHeight: 1366, dpr: 2 }, // 2048x2732 iPad Pro 12.9
];

export const splashFileName = (s: SplashSize): string =>
  `splash-${s.cssWidth * s.dpr}x${s.cssHeight * s.dpr}.png`;

export const APPLE_STARTUP_IMAGES = SPLASH_SIZES.map((s) => ({
  url: `/splash/${splashFileName(s)}`,
  media: `screen and (device-width: ${s.cssWidth}px) and (device-height: ${s.cssHeight}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait)`,
}));
