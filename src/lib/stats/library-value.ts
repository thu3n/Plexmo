import { getLibraryItemFacts, type LibraryItemFacts, type LibraryMediaType, type LibraryScopeParams } from "./library-value-query";
import { computeCoverage, computeFirstPlay, type CoverageResult, type FirstPlayResult } from "./library-value-timing";

/**
 * Library value: what the library costs in disk versus how much it is watched.
 * Every metric is a LIFETIME view of the current inventory — the stats page's
 * period (`days`) deliberately does not apply: a file occupies disk regardless
 * of the window, and a 30-day window would label most of a library "unplayed".
 * Staleness for dead weight has its own knob (`staleMonths`).
 */

export const DEFAULT_STALE_MONTHS = 12;
export const DEFAULT_LIBRARY_LIST_LIMIT = 25;

export type LibraryValueItem = Pick<
    LibraryItemFacts,
    | "serverId" | "serverName" | "ratingKey" | "mediaId" | "type" | "title" | "year"
    | "sectionTitle" | "addedAt" | "fileSize" | "plays" | "lastPlayed" | "thumb"
>;

export type DeadWeightResult = {
    /** Titles never played, or last played before the cutoff (and added before it). */
    count: number;
    /** Sum of known file sizes across ALL dead-weight titles, not just the listed ones. */
    reclaimableBytes: number;
    /** Dead-weight titles whose size is unknown (always all shows — see library-value-query). */
    unknownSizeCount: number;
    items: LibraryValueItem[];
};

export type CostPerPlayItem = LibraryValueItem & { bytesPerPlay: number };

export type CostPerPlayResult = {
    /** Biggest bytes per play first — large files that almost nobody watches. */
    worst: CostPerPlayItem[];
    /** Smallest bytes per play first — the library's best value. */
    best: CostPerPlayItem[];
};

export type LibraryValueResult = {
    /** Epoch ms the result was computed at — clients age rows against this, not their own clock. */
    generatedAt: number;
    staleMonths: number;
    /** Epoch ms: played before this (or never) counts as dead weight. */
    staleCutoff: number;
    deadWeight: Record<LibraryMediaType, DeadWeightResult>;
    costPerPlay: CostPerPlayResult;
    firstPlay: FirstPlayResult;
    coverage: CoverageResult;
};

const toItem = (f: LibraryItemFacts): LibraryValueItem => ({
    serverId: f.serverId,
    serverName: f.serverName,
    ratingKey: f.ratingKey,
    mediaId: f.mediaId,
    type: f.type,
    title: f.title,
    year: f.year,
    sectionTitle: f.sectionTitle,
    addedAt: f.addedAt,
    fileSize: f.fileSize,
    plays: f.plays,
    lastPlayed: f.lastPlayed,
    thumb: f.thumb,
});

/** Calendar months back from `now` (setMonth handles varying month lengths). */
export const staleCutoffFor = (now: number, months: number): number => {
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date.getTime();
};

/**
 * Dead weight = not played since `cutoff` AND added before it — a title added
 * last week that nobody has started yet is not dead weight, just new.
 * Sorted by file size (unknown sizes last), then oldest-added first.
 */
export const computeDeadWeight = (
    facts: LibraryItemFacts[],
    type: LibraryMediaType,
    cutoff: number,
    limit: number,
): DeadWeightResult => {
    const dead = facts.filter(
        (f) =>
            f.type === type &&
            (f.lastPlayed === null || f.lastPlayed < cutoff) &&
            (f.addedAt === null || f.addedAt < cutoff),
    );
    dead.sort(
        (a, b) =>
            (b.fileSize ?? -1) - (a.fileSize ?? -1) ||
            (a.addedAt ?? 0) - (b.addedAt ?? 0) ||
            a.title.localeCompare(b.title),
    );
    return {
        count: dead.length,
        reclaimableBytes: dead.reduce((sum, f) => sum + (f.fileSize ?? 0), 0),
        unknownSizeCount: dead.filter((f) => f.fileSize === null).length,
        items: dead.slice(0, limit).map(toItem),
    };
};

/**
 * Bytes per lifetime play for played titles with a known size (movies only in
 * practice). Never-played titles have no finite cost per play — they are the
 * dead-weight list. When fewer than 2 × limit titles qualify, `best` omits
 * titles already in `worst` so the two lists never show the same row.
 */
export const computeCostPerPlay = (facts: LibraryItemFacts[], limit: number): CostPerPlayResult => {
    const priced: CostPerPlayItem[] = facts
        .filter((f) => f.fileSize !== null && f.fileSize > 0 && f.plays > 0)
        .map((f) => ({ ...toItem(f), bytesPerPlay: (f.fileSize ?? 0) / f.plays }));

    const worst = [...priced]
        .sort((a, b) => b.bytesPerPlay - a.bytesPerPlay || a.plays - b.plays)
        .slice(0, limit);
    const worstKeys = new Set(worst.map((i) => `${i.serverId}:${i.ratingKey}`));
    const best = priced
        .filter((i) => !worstKeys.has(`${i.serverId}:${i.ratingKey}`))
        .sort((a, b) => a.bytesPerPlay - b.bytesPerPlay || b.plays - a.plays)
        .slice(0, limit);
    return { worst, best };
};

export type LibraryValueParams = LibraryScopeParams & {
    staleMonths?: number;
    limit?: number;
    now?: number;
};

export const getLibraryValue = (params: LibraryValueParams): LibraryValueResult => {
    const now = params.now ?? Date.now();
    const staleMonths = params.staleMonths ?? DEFAULT_STALE_MONTHS;
    const limit = params.limit ?? DEFAULT_LIBRARY_LIST_LIMIT;
    const staleCutoff = staleCutoffFor(now, staleMonths);
    const facts = getLibraryItemFacts(params);

    return {
        generatedAt: now,
        staleMonths,
        staleCutoff,
        deadWeight: {
            movie: computeDeadWeight(facts, "movie", staleCutoff, limit),
            show: computeDeadWeight(facts, "show", staleCutoff, limit),
        },
        costPerPlay: computeCostPerPlay(facts, limit),
        firstPlay: computeFirstPlay(facts),
        coverage: computeCoverage(facts),
    };
};
