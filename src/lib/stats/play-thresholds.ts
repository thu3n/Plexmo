/**
 * A play qualifies as "real" at >= MIN_PLAY_PERCENT of the item's runtime, or
 * >= MIN_PLAY_SECONDS_FALLBACK seconds of actual playback when completion is
 * unknown. Shared by home-stats (top-media qualification) and streaks (day
 * qualification) so the two never drift apart.
 */
export const MIN_PLAY_PERCENT = 20;
export const MIN_PLAY_SECONDS_FALLBACK = 600;
