/**
 * Statistics v2 visual tokens, aligned with the rest of Plexmo: glass panels
 * over the app background, amber as the single data accent (the brand colour
 * the dashboard and v1 stats already use), and the same stream-decision
 * colours as the dashboard's Streams card so a decision reads the same
 * everywhere.
 */

/** Card surface — the app-wide glass panel. */
export const PANEL_CLASS = "glass-panel rounded-2xl";

/** Nested surface inside a panel (server tiles, chart tooltips). */
export const INSET_CLASS = "rounded-xl border border-white/5 bg-white/[0.03]";

/** Primary data colour for series, bars and sparklines (Tailwind amber-400). */
export const ACCENT = "#fbbf24";

/** Link-style actions ("View all", "Manage"). */
export const LINK_CLASS = "text-amber-400 hover:text-amber-300";

/** Tailwind emerald-400 / sky-400 / rose-400 — identical to the dashboard Streams card. */
export const DECISION_COLORS = {
    directPlay: "#34d399",
    directStream: "#38bdf8",
    transcode: "#fb7185",
} as const;

/** Faint grid / track colour for charts and meters. */
export const TRACK = "rgba(255,255,255,0.06)";

/** Tooltip surface for recharts (inline styles, so a colour rather than a class). */
export const TOOLTIP_STYLE = {
    backgroundColor: "rgba(10,10,14,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
};
