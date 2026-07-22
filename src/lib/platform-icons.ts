/**
 * Single source of truth for platform/player → icon file + brand color.
 * Previously duplicated verbatim in dashboard sessionUtils, history helpers
 * and the user-statistics page. Icons live in /public/images/platforms/.
 */

/** Keyword (substring of player/platform, lowercase) → icon filename. */
export const PLATFORM_ICON_MAP: Record<string, string> = {
    android: "android",
    ios: "ios",
    apple: "ios",
    iphone: "ios",
    ipad: "ios",
    tvos: "atv",
    chrome: "chrome",
    firefox: "firefox",
    edge: "msedge",
    safari: "safari",
    lg: "lg",
    webos: "lg",
    samsung: "samsung",
    tizen: "samsung",
    roku: "roku",
    playstation: "playstation",
    ps4: "playstation",
    ps5: "playstation",
    xbox: "xbox",
    wiiu: "wiiu",
    kodi: "kodi",
    plexamp: "plexamp",
    linux: "linux",
    macos: "macos",
    osx: "macos",
    windows: "windows",
    opera: "opera",
    ie: "ie",
    dlna: "dlna",
    chromecast: "chromecast",
    alexa: "alexa",
    tivo: "tivo",
};

/** Icon filename → brand color (Tautulli-style palette). */
export const PLATFORM_COLORS: Record<string, string> = {
    alexa: "#00caff",
    android: "#3ddc84",
    atv: "#a2aaad",
    chrome: "#db4437",
    chromecast: "#4285f4",
    default: "#e5a00d",
    dlna: "#4ba32f",
    firefox: "#ff7139",
    gtv: "#008bcf",
    ie: "#18bcef",
    ios: "#a2aaad",
    kodi: "#30aada",
    lg: "#990033",
    linux: "#0099cc",
    macos: "#a2aaad",
    msedge: "#0078d7",
    opera: "#fa1e4e",
    playstation: "#003087",
    plex: "#e5a00d",
    plexamp: "#e5a00d",
    roku: "#673293",
    safari: "#00d3f9",
    samsung: "#034ea2",
    synclounge: "#151924",
    tivo: "#00a7e1",
    wiiu: "#03a9f4",
    windows: "#0078d7",
    wp: "#68217a",
    xbmc: "#3b4872",
    xbox: "#107c10",
};

const DEFAULT_ICON = "plex";
const DEFAULT_COLOR = PLATFORM_COLORS.default;

/** Resolve player/platform strings to an icon filename + brand color. */
export const getPlayerIconInfo = (
    player: string | undefined,
    platform: string | undefined
): { icon: string; color: string } => {
    const p = (player || platform || "").toLowerCase();
    for (const [key, icon] of Object.entries(PLATFORM_ICON_MAP)) {
        if (p.includes(key)) {
            return { icon, color: PLATFORM_COLORS[icon] ?? DEFAULT_COLOR };
        }
    }
    return { icon: DEFAULT_ICON, color: DEFAULT_COLOR };
};
