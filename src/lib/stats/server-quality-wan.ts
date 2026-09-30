import { db } from "../db";
import { buildQualityFilter, WAN_LOCATION, type QualityParams } from "./server-quality-filter";

/**
 * Peak concurrent WAN (upload) bandwidth per hour / day / month, from history
 * intervals. concurrent_snapshots carry no bandwidth or location, so this
 * sweeps each remote play's [startTime, stopTime) at its recorded bandwidth.
 * Wallclock intervals include paused time, so peaks lean slightly high —
 * the safe direction when comparing against upload capacity.
 */

export type WanGranularity = "hour" | "day" | "month";

/** Up to a week, hourly peaks are readable; beyond a year, monthly. */
export const HOURLY_MAX_DAYS = 7;
export const DAILY_MAX_DAYS = 365;
/** Plays that started this long before the window can still overlap it. */
const OVERLAP_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const KBPS_PER_MBPS = 1000;
const MBPS_DECIMALS = 10;

export const pickGranularity = (days: number): WanGranularity =>
    days <= HOURLY_MAX_DAYS ? "hour" : days <= DAILY_MAX_DAYS ? "day" : "month";

export type WanInterval = { start: number; stop: number; kbps: number };
export type WanPoint = { bucket: string; peakMbps: number; peakStreams: number };

const pad = (n: number) => String(n).padStart(2, "0");

const floorToBucket = (time: number, granularity: WanGranularity): Date => {
    const d = new Date(time);
    d.setMinutes(0, 0, 0);
    if (granularity !== "hour") d.setHours(0);
    if (granularity === "month") d.setDate(1);
    return d;
};

const nextBucket = (d: Date, granularity: WanGranularity): Date => {
    const next = new Date(d);
    if (granularity === "hour") next.setHours(next.getHours() + 1);
    else if (granularity === "day") next.setDate(next.getDate() + 1);
    else next.setMonth(next.getMonth() + 1);
    return next;
};

/** Local-time labels matching graph-stats buckets: "2026-09-30 14:00", "2026-09-30", "2026-09". */
export const bucketLabel = (d: Date, granularity: WanGranularity): string => {
    const month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    if (granularity === "month") return month;
    const day = `${month}-${pad(d.getDate())}`;
    return granularity === "day" ? day : `${day} ${pad(d.getHours())}:00`;
};

const toMbps = (kbps: number) => Math.round((kbps / KBPS_PER_MBPS) * MBPS_DECIMALS) / MBPS_DECIMALS;

/**
 * Sweep-line peak per bucket. Stops sort before starts at the same instant so
 * back-to-back plays don't count as overlapping. Leading empty buckets are
 * trimmed (an all-time window otherwise opens with years of zeros).
 */
export const peakSeries = (
    intervals: WanInterval[],
    since: number,
    until: number,
    granularity: WanGranularity,
): WanPoint[] => {
    const events = intervals
        .filter((i) => i.stop > i.start && i.kbps > 0 && i.stop > since && i.start < until)
        .flatMap((i) => [
            { t: Math.max(i.start, since), kbps: i.kbps, streams: 1 },
            { t: Math.min(i.stop, until), kbps: -i.kbps, streams: -1 },
        ])
        .sort((a, b) => a.t - b.t || a.streams - b.streams);
    if (events.length === 0) return [];

    const points: WanPoint[] = [];
    let level = 0;
    let streams = 0;
    let ei = 0;
    const apply = () => {
        level += events[ei].kbps;
        streams += events[ei].streams;
        ei += 1;
    };

    for (let start = floorToBucket(events[0].t, granularity); start.getTime() < until; start = nextBucket(start, granularity)) {
        const end = nextBucket(start, granularity).getTime();
        while (ei < events.length && events[ei].t <= start.getTime()) apply();
        let peak = level;
        let peakStreams = streams;
        while (ei < events.length && events[ei].t < end) {
            apply();
            peak = Math.max(peak, level);
            peakStreams = Math.max(peakStreams, streams);
        }
        points.push({ bucket: bucketLabel(start, granularity), peakMbps: toMbps(peak), peakStreams });
    }
    return points;
};

export type WanLoadResult = {
    granularity: WanGranularity;
    points: WanPoint[];
    peakMbps: number;
    peakBucket: string | null;
    wanPlays: number;
};

export const getWanLoad = (params: QualityParams & { until: number; granularity: WanGranularity }): WanLoadResult => {
    const { since, until, granularity } = params;
    const { where, args } = buildQualityFilter({ ...params, since: since - OVERLAP_LOOKBACK_MS });
    const intervals = db.prepare(`
        SELECT h.startTime AS start, h.stopTime AS stop, h.bandwidth AS kbps
        FROM activity_history h
        WHERE ${where} AND h.stopTime > ? AND h.location = '${WAN_LOCATION}' AND h.bandwidth > 0
    `).all(...args, since) as WanInterval[];

    const points = peakSeries(intervals, since, until, granularity);
    const top = points.reduce<WanPoint | null>((best, p) => (!best || p.peakMbps > best.peakMbps ? p : best), null);
    return {
        granularity,
        points,
        peakMbps: top?.peakMbps ?? 0,
        peakBucket: top && top.peakMbps > 0 ? top.bucket : null,
        wanPlays: intervals.length,
    };
};
