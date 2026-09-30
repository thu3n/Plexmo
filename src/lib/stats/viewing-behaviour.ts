import { buildFilter, type HomeStatsParams } from "./home-stats";
import { MIN_PLAY_PERCENT, MIN_PLAY_SECONDS_FALLBACK } from "./play-thresholds";

/**
 * Shared plumbing for the viewing-behaviour stats (completion, binges,
 * abandoned series, pause intensity): these measure HOW people watch rather
 * than how much. Each metric lives in its own viewing-behaviour-*.ts module;
 * this file only holds the filter, the title roll-up joins and the
 * qualified-play gate they share.
 */

export type BehaviourParams = Pick<HomeStatsParams, "since" | "serverId" | "allowedServerIds"> & {
    /** Exclusive window end, epoch ms. */
    until: number;
    limit?: number;
};

export type BehaviourMediaType = "movie" | "show";

export const BEHAVIOUR_MEDIA_TYPES: readonly BehaviourMediaType[] = ["movie", "show"];

export const DEFAULT_BEHAVIOUR_LIMIT = 10;

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** WHERE clause over `h` (activity_history) honouring window, server filter and scope. */
export const behaviourFilter = ({ since, until, serverId, allowedServerIds }: BehaviourParams) =>
    buildFilter({ since, until, serverId, allowedServerIds });

/**
 * Same gate as the top-media stats (home-stats.ts): the viewer got meaningfully
 * into the item, so restarts and accidental clicks don't count as viewing.
 */
export const QUALIFIED_PLAY_SQL = `(
  h.percent_complete >= ${MIN_PLAY_PERCENT}
  OR (h.percent_complete IS NULL AND COALESCE(h.play_duration, h.duration) >= ${MIN_PLAY_SECONDS_FALLBACK})
)`;

/**
 * Title roll-up per media type: a movie is its own title, an episode rolls up
 * to its show — the same canonical grain the top lists use. Constant SQL,
 * never built from user input.
 */
export const TITLE_JOIN: Record<BehaviourMediaType, { join: string; titleId: string }> = {
    movie: {
        join: "JOIN media_items e ON h.mediaId = e.id AND e.type = 'movie'",
        titleId: "e.id",
    },
    show: {
        join: "JOIN media_items e ON h.mediaId = e.id AND e.showMediaId IS NOT NULL",
        titleId: "e.showMediaId",
    },
};

/** Integer percentage 0–100, 0 for an empty denominator. */
export const ratePercent = (part: number, total: number): number =>
    total > 0 ? Math.round((part / total) * 100) : 0;
