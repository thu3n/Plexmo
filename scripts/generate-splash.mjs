/**
 * Generates the iOS PWA launch screens (apple-touch-startup-image) into public/splash/.
 * One-time tool: run `npm run generate:splash` after changing the icon or size table,
 * then commit the PNGs. Requires the `sharp` devDependency.
 *
 * The size table mirrors SPLASH_SIZES in src/lib/pwa-splash.ts (plain data here — this
 * script is ESM JS, the app is TS). src/test/pwa-splash.test.ts fails if they drift.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Keep in sync with APP_BACKGROUND_COLOR in src/lib/theme.ts.
const BACKGROUND = "#05070f";
const ICON_SOURCE = "public/icons/icon-512.png";
const OUT_DIR = "public/splash";
// Icon occupies this fraction of the splash's short side, never upscaled past the source.
const ICON_FRACTION = 0.28;
const ICON_MAX_PX = 512;

// [cssWidth, cssHeight, dpr] — portrait iPhone + iPad set.
const SPLASH_SIZES = [
  [375, 667, 2],
  [414, 896, 2],
  [375, 812, 3],
  [414, 896, 3],
  [360, 780, 3],
  [390, 844, 3],
  [428, 926, 3],
  [393, 852, 3],
  [430, 932, 3],
  [402, 874, 3],
  [440, 956, 3],
  [420, 912, 3],
  [768, 1024, 2],
  [810, 1080, 2],
  [820, 1180, 2],
  [834, 1194, 2],
  [1024, 1366, 2],
];

mkdirSync(OUT_DIR, { recursive: true });

for (const [cssWidth, cssHeight, dpr] of SPLASH_SIZES) {
  const width = cssWidth * dpr;
  const height = cssHeight * dpr;
  const iconSize = Math.min(Math.round(ICON_FRACTION * Math.min(width, height)), ICON_MAX_PX);
  const icon = await sharp(ICON_SOURCE)
    .resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const outFile = path.join(OUT_DIR, `splash-${width}x${height}.png`);
  await sharp({ create: { width, height, channels: 4, background: BACKGROUND } })
    .composite([{ input: icon, gravity: "center" }])
    // palette: near-flat art (solid bg + logo) is visually lossless at 128 colors and
    // ~5x smaller — these PNGs are fetched by every iOS visit, so bytes matter.
    .png({ compressionLevel: 9, palette: true, colors: 128 })
    .toFile(outFile);
  console.log(`wrote ${outFile} (${width}x${height}, icon ${iconSize}px)`);
}
