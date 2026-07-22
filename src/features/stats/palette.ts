/**
 * Chart palette for the statistics feature. Validated against the app's dark
 * surface with the dataviz six-checks validator (lightness band, chroma floor,
 * CVD separation, contrast) — change values only after re-running it.
 * Identity is fixed per decision category, never assigned by rank.
 */
export const DECISION_COLORS = {
  directPlay: "#059669",
  directStream: "#0284c7",
  transcode: "#f43f5e",
  unknown: "#8b5cf6",
} as const;

export const DECISION_LABELS = {
  directPlay: "Direct Play",
  directStream: "Direct Stream",
  transcode: "Transcode",
  unknown: "Unknown",
} as const;

export type DecisionKey = keyof typeof DECISION_COLORS;

export const DECISION_ORDER: DecisionKey[] = [
  "directPlay",
  "directStream",
  "transcode",
  "unknown",
];

/** Chart surface + ink tokens matching the app's glass-panel dark UI. */
export const CHART_INK = {
  grid: "rgba(255,255,255,0.06)",
  axis: "rgba(255,255,255,0.35)",
  tooltipBg: "#1c1c1e",
  tooltipBorder: "rgba(255,255,255,0.1)",
} as const;
