import { db } from "../db";
import { resolveMediaThumbs, type ThumbRef } from "./media-thumbs";
import {
    DEFAULT_BEHAVIOUR_LIMIT,
    QUALIFIED_PLAY_SQL,
    behaviourFilter,
    type BehaviourParams,
} from "./viewing-behaviour";
import { BINGE_GAP_MS, MIN_BINGE_EPISODES } from "./viewing-behaviour-constants";

/**
 * Binges: distinct episodes of ONE show watched back to back by one user. The
 * next episode continues the run when it starts within BINGE_GAP_MS of the
 * previous one ending (snack, bathroom, "one more?"). Any other show in
 * between breaks the run. Re-watching or resuming the same episode never
 * lengthens it — only distinct episodes count.
 */

export { BINGE_GAP_MS, MIN_BINGE_EPISODES };

export type EpisodePlay = {
    userId: string;
    user: string;
    showId: number;
    showTitle: string;
    episodeId: number;
    startTime: number;
    stopTime: number;
};

export type BingeRun = {
    userId: string;
    user: string;
    showId: number;
    showTitle: string;
    episodes: number;
    startTime: number;
    stopTime: number;
};

export type BingeShow = {
    mediaId: number;
    title: string;
    binges: number;
    users: number;
    /** Most episodes in a single binge of this show. */
    longest: number;
    /** Mean episodes per binge, one decimal. */
    avgEpisodes: number;
    thumb: ThumbRef | null;
};

export type BingeStats = {
    binges: number;
    bingeEpisodes: number;
    avgEpisodes: number;
    bingers: number;
    topShows: BingeShow[];
    longest: BingeRun[];
};

type OpenRun = { first: EpisodePlay; episodes: Set<number>; lastStop: number };

const toRun = ({ first, episodes, lastStop }: OpenRun): BingeRun => ({
    userId: first.userId,
    user: first.user,
    showId: first.showId,
    showTitle: first.showTitle,
    episodes: episodes.size,
    startTime: first.startTime,
    stopTime: lastStop,
});

/** Pure run detection over plays sorted by (userId, startTime). */
export const detectBinges = (plays: EpisodePlay[]): BingeRun[] => {
    const runs: BingeRun[] = [];
    let open: OpenRun | null = null;

    const close = () => {
        if (open && open.episodes.size >= MIN_BINGE_EPISODES) runs.push(toRun(open));
        open = null;
    };

    for (const play of plays) {
        const continues: boolean =
            open !== null &&
            open.first.userId === play.userId &&
            open.first.showId === play.showId &&
            play.startTime - open.lastStop <= BINGE_GAP_MS;
        if (continues && open) {
            open.episodes.add(play.episodeId);
            open.lastStop = Math.max(open.lastStop, play.stopTime);
            continue;
        }
        close();
        open = { first: play, episodes: new Set([play.episodeId]), lastStop: play.stopTime };
    }
    close();
    return runs;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const rankShows = (runs: BingeRun[], limit: number): Omit<BingeShow, "thumb">[] => {
    const byShow = new Map<number, { title: string; runs: BingeRun[] }>();
    for (const run of runs) {
        const entry = byShow.get(run.showId) ?? { title: run.showTitle, runs: [] };
        entry.runs.push(run);
        byShow.set(run.showId, entry);
    }
    return [...byShow.entries()]
        .map(([mediaId, { title, runs: showRuns }]) => {
            const episodes = showRuns.reduce((sum, r) => sum + r.episodes, 0);
            return {
                mediaId,
                title,
                binges: showRuns.length,
                users: new Set(showRuns.map((r) => r.userId)).size,
                longest: Math.max(...showRuns.map((r) => r.episodes)),
                avgEpisodes: round1(episodes / showRuns.length),
            };
        })
        .sort((a, b) => b.binges - a.binges || b.longest - a.longest)
        .slice(0, limit);
};

export const getBingeStats = (params: BehaviourParams): BingeStats => {
    const { where, args } = behaviourFilter(params);
    const limit = params.limit ?? DEFAULT_BEHAVIOUR_LIMIT;

    const plays = db.prepare(`
        SELECT
            h.userId AS userId,
            COALESCE(ui.title, h.user) AS user,
            e.showMediaId AS showId,
            p.title AS showTitle,
            e.id AS episodeId,
            h.startTime AS startTime,
            h.stopTime AS stopTime
        FROM activity_history h
        JOIN media_items e ON h.mediaId = e.id AND e.showMediaId IS NOT NULL
        JOIN media_items p ON p.id = e.showMediaId
        LEFT JOIN user_identities ui ON ui.accountId = h.userId
        WHERE ${where} AND h.userId IS NOT NULL AND ${QUALIFIED_PLAY_SQL}
        ORDER BY h.userId, h.startTime
    `).all(...args) as EpisodePlay[];

    const runs = detectBinges(plays);
    const bingeEpisodes = runs.reduce((sum, r) => sum + r.episodes, 0);
    const topShows = rankShows(runs, limit);
    const thumbs = resolveMediaThumbs(topShows.map((s) => s.mediaId), params.allowedServerIds);

    return {
        binges: runs.length,
        bingeEpisodes,
        avgEpisodes: runs.length > 0 ? round1(bingeEpisodes / runs.length) : 0,
        bingers: new Set(runs.map((r) => r.userId)).size,
        topShows: topShows.map((s) => ({ ...s, thumb: thumbs.get(s.mediaId) ?? null })),
        longest: [...runs]
            .sort((a, b) => b.episodes - a.episodes || (b.stopTime - b.startTime) - (a.stopTime - a.startTime))
            .slice(0, limit),
    };
};
