/**
 * Longest binge for Wrapped: the longest run of episodes of ONE show watched
 * back to back. Pure, so the run-splitting rules are unit-testable.
 */

/** Max break between one episode ending and the next starting that still counts as "in a row". */
export const BINGE_GAP_MS = 30 * 60 * 1000;
/** One episode is just watching TV. */
export const MIN_BINGE_EPISODES = 2;

export type BingeRow = {
    startTime: number;
    stopTime: number;
    /** Episode media id — rewatching the same episode does not lengthen a binge. */
    mediaId: number;
    showMediaId: number;
    showTitle: string;
    seconds: number;
};

export type Binge = {
    showMediaId: number;
    showTitle: string;
    episodes: number;
    seconds: number;
    startedAt: number;
    endedAt: number;
};

type Run = Omit<Binge, "episodes"> & { episodeIds: Set<number> };

const isLonger = (a: Run, b: Run | null): boolean =>
    !b || a.episodeIds.size > b.episodeIds.size || (a.episodeIds.size === b.episodeIds.size && a.seconds > b.seconds);

/**
 * `rows` must be episode plays sorted by startTime. A different show in
 * between, or a gap over `gapMs`, ends the run.
 */
export const findLongestBinge = (rows: BingeRow[], gapMs: number = BINGE_GAP_MS): Binge | null => {
    let best: Run | null = null;
    let run: Run | null = null;

    for (const row of rows) {
        const continues = run && run.showMediaId === row.showMediaId && row.startTime - run.endedAt <= gapMs;
        if (run && continues) {
            run.episodeIds.add(row.mediaId);
            run.seconds += row.seconds;
            run.endedAt = Math.max(run.endedAt, row.stopTime);
            continue;
        }
        if (run && isLonger(run, best)) best = run;
        run = {
            showMediaId: row.showMediaId,
            showTitle: row.showTitle,
            episodeIds: new Set([row.mediaId]),
            seconds: row.seconds,
            startedAt: row.startTime,
            endedAt: row.stopTime,
        };
    }
    if (run && isLonger(run, best)) best = run;

    if (!best || best.episodeIds.size < MIN_BINGE_EPISODES) return null;
    const { episodeIds, ...rest } = best;
    return { ...rest, episodes: episodeIds.size };
};
