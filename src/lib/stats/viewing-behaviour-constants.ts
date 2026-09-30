/**
 * Viewing-behaviour thresholds the UI also explains in its captions. Kept in a
 * dependency-free module so client components can import them without
 * pulling the SQLite-backed stats modules into the browser bundle.
 */

/** Next episode continues a binge when it starts within this long of the previous one ending. */
export const BINGE_GAP_MS = 30 * 60_000;
/** Two in a row is an evening; three is a binge. */
export const MIN_BINGE_EPISODES = 3;
/** Days without touching a show before a mid-season stop counts as abandoned. */
export const ABANDON_AFTER_DAYS = 30;
