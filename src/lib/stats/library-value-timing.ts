import { LIBRARY_MEDIA_TYPES, type LibraryItemFacts, type LibraryMediaType } from "./library-value-query";

/**
 * Time-to-first-play and coverage — pure derivations over library facts
 * (see library-value-query for how plays are matched to library copies).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;

export type FirstPlayBucketKey = "sameDay" | "week" | "month" | "later" | "never";

/** Upper bounds (exclusive) of the timed buckets, in ascending order. */
const BUCKET_LIMITS: { key: Exclude<FirstPlayBucketKey, "never">; maxMs: number }[] = [
    { key: "sameDay", maxMs: MS_PER_DAY },
    { key: "week", maxMs: DAYS_PER_WEEK * MS_PER_DAY },
    { key: "month", maxMs: DAYS_PER_MONTH * MS_PER_DAY },
    { key: "later", maxMs: Number.POSITIVE_INFINITY },
];

export const FIRST_PLAY_BUCKET_ORDER: readonly FirstPlayBucketKey[] = ["sameDay", "week", "month", "later", "never"];

export type FirstPlayStats = {
    /** Copies with a known addedAt. */
    total: number;
    /** Of those, copies played at least once after being added. */
    played: number;
    /** Median delay from addedAt to first play over played copies; null when none. */
    medianMs: number | null;
    buckets: { key: FirstPlayBucketKey; count: number }[];
};

export type FirstPlayResult = Record<LibraryMediaType, FirstPlayStats>;

export type CoverageSection = {
    serverId: string;
    serverName: string | null;
    sectionKey: string;
    sectionTitle: string | null;
    type: LibraryMediaType;
    total: number;
    played: number;
};

export type CoverageResult = {
    sections: CoverageSection[];
    byType: Record<LibraryMediaType, { total: number; played: number }>;
};

export const median = (values: number[]): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export const firstPlayBucket = (delayMs: number | null): FirstPlayBucketKey => {
    if (delayMs === null) return "never";
    return BUCKET_LIMITS.find((b) => delayMs < b.maxMs)?.key ?? "later";
};

const firstPlayStatsFor = (facts: LibraryItemFacts[]): FirstPlayStats => {
    const counts = new Map<FirstPlayBucketKey, number>(FIRST_PLAY_BUCKET_ORDER.map((k) => [k, 0]));
    const delays: number[] = [];
    let total = 0;
    for (const f of facts) {
        if (f.addedAt === null) continue;
        total++;
        const delay = f.firstPlayAfterAdded === null ? null : f.firstPlayAfterAdded - f.addedAt;
        if (delay !== null) delays.push(delay);
        const key = firstPlayBucket(delay);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return {
        total,
        played: delays.length,
        medianMs: median(delays),
        buckets: FIRST_PLAY_BUCKET_ORDER.map((key) => ({ key, count: counts.get(key) ?? 0 })),
    };
};

/**
 * Delay between a copy landing in the library and its first qualified play on
 * that server, per type. Copies without addedAt are skipped. "never" includes
 * recently added titles that simply have not had their chance yet.
 */
export const computeFirstPlay = (facts: LibraryItemFacts[]): FirstPlayResult => ({
    movie: firstPlayStatsFor(facts.filter((f) => f.type === "movie")),
    show: firstPlayStatsFor(facts.filter((f) => f.type === "show")),
});

/** Share of library copies played at least once, per section and per type. */
export const computeCoverage = (facts: LibraryItemFacts[]): CoverageResult => {
    const sections = new Map<string, CoverageSection>();
    const byType = Object.fromEntries(
        LIBRARY_MEDIA_TYPES.map((t) => [t, { total: 0, played: 0 }]),
    ) as CoverageResult["byType"];

    for (const f of facts) {
        const key = `${f.serverId}:${f.sectionKey}`;
        let section = sections.get(key);
        if (!section) {
            section = {
                serverId: f.serverId,
                serverName: f.serverName,
                sectionKey: f.sectionKey,
                sectionTitle: f.sectionTitle,
                type: f.type,
                total: 0,
                played: 0,
            };
            sections.set(key, section);
        }
        const wasPlayed = f.plays > 0 ? 1 : 0;
        section.total++;
        section.played += wasPlayed;
        byType[f.type].total++;
        byType[f.type].played += wasPlayed;
    }

    return {
        sections: [...sections.values()].sort(
            (a, b) =>
                (a.serverName ?? "").localeCompare(b.serverName ?? "") ||
                (a.sectionTitle ?? "").localeCompare(b.sectionTitle ?? ""),
        ),
        byType,
    };
};
