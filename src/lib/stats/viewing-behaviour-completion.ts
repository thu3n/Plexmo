import { db } from "../db";
import { WATCHED_THRESHOLD_PERCENT } from "../history/session-facts";
import { resolveMediaThumbs, type ThumbRef } from "./media-thumbs";
import {
    DEFAULT_BEHAVIOUR_LIMIT,
    TITLE_JOIN,
    behaviourFilter,
    ratePercent,
    type BehaviourMediaType,
    type BehaviourParams,
} from "./viewing-behaviour";

/**
 * Completion: did people finish what they started? The unit is an ATTEMPT —
 * one user × one item (movie or episode) in the window, at the furthest point
 * they reached across all rows (a resume the next day finishes the attempt, it
 * doesn't add a second abandoned one). Rows without a known position (pre-v5
 * history, imports without view offset) carry no completion signal and are
 * skipped.
 */

/** Histogram resolution; 5% steps put the 85% "watched" line on a bucket edge. */
export const DROP_OFF_BUCKET_PERCENT = 5;
const BUCKET_COUNT = 100 / DROP_OFF_BUCKET_PERCENT;
/** Below this much actual play time an attempt is a misclick, not a decision to stop. */
export const MIN_ATTEMPT_SECONDS = 120;
/** A completion rate over fewer attempts is anecdote. */
export const MIN_TITLE_ATTEMPTS = 3;
/** "People give up on it" needs more than one person. */
export const MIN_GIVE_UP_USERS = 2;
/** Titles most people finish don't belong on the give-up list. */
export const MAX_GIVE_UP_RATE = 50;

export type DropOffBucket = {
    /** Inclusive lower bound, percent of runtime. */
    from: number;
    /** Exclusive upper bound (100 inclusive for the last bucket). */
    to: number;
    attempts: number;
    /** At or past the watched threshold — the attempt counts as finished. */
    finished: boolean;
};

export type TitleCompletion = {
    mediaId: number;
    title: string;
    year: number | null;
    attempts: number;
    finished: number;
    /** 0–100. */
    completionRate: number;
    /** Mean stop point of the unfinished attempts; null when all finished. */
    avgStopPercent: number | null;
    users: number;
    thumb: ThumbRef | null;
};

export type CompletionStats = {
    attempts: number;
    finished: number;
    completionRate: number;
    histogram: DropOffBucket[];
    /** Most-started titles with their completion rate. */
    titles: TitleCompletion[];
    /** Lowest completion rate first. */
    givenUp: TitleCompletion[];
};

type TitleRow = Omit<TitleCompletion, "completionRate" | "thumb" | "avgStopPercent"> & {
    avgStopPercent: number | null;
};

const attemptsCte = (type: BehaviourMediaType, where: string) => `
    WITH attempts AS (
        SELECT h.userId AS userId, ${TITLE_JOIN[type].titleId} AS titleId, MAX(h.percent_complete) AS pct
        FROM activity_history h
        ${TITLE_JOIN[type].join}
        WHERE ${where} AND h.percent_complete IS NOT NULL AND h.userId IS NOT NULL
        GROUP BY h.userId, h.mediaId
        HAVING SUM(COALESCE(h.play_duration, h.duration)) >= ?
    )`;

const buildHistogram = (rows: { bucket: number; attempts: number }[]): DropOffBucket[] => {
    const counts = new Map(rows.map((r) => [r.bucket, r.attempts]));
    return Array.from({ length: BUCKET_COUNT }, (_, i) => {
        const from = i * DROP_OFF_BUCKET_PERCENT;
        return {
            from,
            to: from + DROP_OFF_BUCKET_PERCENT,
            attempts: counts.get(i) ?? 0,
            finished: from >= WATCHED_THRESHOLD_PERCENT,
        };
    });
};

export const getCompletionStats = (type: BehaviourMediaType, params: BehaviourParams): CompletionStats => {
    const { where, args } = behaviourFilter(params);
    const limit = params.limit ?? DEFAULT_BEHAVIOUR_LIMIT;
    const cte = attemptsCte(type, where);

    const bucketRows = db.prepare(`${cte}
        SELECT MIN(?, CAST(pct / ? AS INTEGER)) AS bucket, COUNT(*) AS attempts
        FROM attempts
        GROUP BY bucket
    `).all(...args, MIN_ATTEMPT_SECONDS, BUCKET_COUNT - 1, DROP_OFF_BUCKET_PERCENT) as {
        bucket: number;
        attempts: number;
    }[];

    const titleRows = db.prepare(`${cte}
        SELECT
            a.titleId AS mediaId,
            t.title,
            t.year,
            COUNT(*) AS attempts,
            SUM(CASE WHEN a.pct >= ? THEN 1 ELSE 0 END) AS finished,
            AVG(CASE WHEN a.pct < ? THEN a.pct END) AS avgStopPercent,
            COUNT(DISTINCT a.userId) AS users
        FROM attempts a
        JOIN media_items t ON t.id = a.titleId
        GROUP BY a.titleId
        HAVING COUNT(*) >= ?
    `).all(
        ...args,
        MIN_ATTEMPT_SECONDS,
        WATCHED_THRESHOLD_PERCENT,
        WATCHED_THRESHOLD_PERCENT,
        MIN_TITLE_ATTEMPTS,
    ) as TitleRow[];

    const histogram = buildHistogram(bucketRows);
    const attempts = histogram.reduce((sum, b) => sum + b.attempts, 0);
    const finished = histogram.filter((b) => b.finished).reduce((sum, b) => sum + b.attempts, 0);

    const scored = titleRows.map((row) => ({
        ...row,
        avgStopPercent: row.avgStopPercent === null ? null : Math.round(row.avgStopPercent),
        completionRate: ratePercent(row.finished, row.attempts),
    }));

    const titles = [...scored]
        .sort((a, b) => b.attempts - a.attempts || b.completionRate - a.completionRate)
        .slice(0, limit);
    const givenUp = scored
        .filter((t) => t.users >= MIN_GIVE_UP_USERS && t.completionRate < MAX_GIVE_UP_RATE)
        .sort((a, b) => a.completionRate - b.completionRate || b.attempts - a.attempts)
        .slice(0, limit);

    const thumbs = resolveMediaThumbs(
        [...titles, ...givenUp].map((t) => t.mediaId),
        params.allowedServerIds,
    );
    const withThumb = (t: Omit<TitleCompletion, "thumb">): TitleCompletion => ({
        ...t,
        thumb: thumbs.get(t.mediaId) ?? null,
    });

    return {
        attempts,
        finished,
        completionRate: ratePercent(finished, attempts),
        histogram,
        titles: titles.map(withThumb),
        givenUp: givenUp.map(withThumb),
    };
};
