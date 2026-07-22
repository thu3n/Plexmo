import { describe, expect, it } from "vitest";
import { buildThumbUrl, mapTopMediaToRows } from "@/features/stats/lib/top-media-list";
import { ALL_TIME_DAYS, STATS_PERIODS } from "@/features/stats/lib/stats-periods";
import type { TopMediaItem, TopMediaSort } from "@/features/stats/hooks/useOverviewData";

const formatValueLabel = (count: number, metric: TopMediaSort) =>
    metric === "users" ? `${count} users` : `${count} plays`;

const movie: TopMediaItem = {
    mediaId: 7,
    title: "A Minecraft Movie",
    year: 2025,
    plays: 112,
    uniqueUsers: 29,
    duration: 1000,
    lastPlayed: 1,
    thumb: { path: "/library/metadata/7/thumb", serverId: "srv-1" },
};

const episode: TopMediaItem = {
    mediaId: 42,
    title: "Pilot",
    year: 2024,
    plays: 55,
    uniqueUsers: 12,
    duration: 500,
    lastPlayed: 2,
    showTitle: "Severance",
    seasonNumber: 1,
    episodeNumber: 3,
    thumb: null,
};

describe("mapTopMediaToRows", () => {
    it("maps movies with year sublabel and metric-specific value", () => {
        const [byUsers] = mapTopMediaToRows([movie], "users", "movie", formatValueLabel);
        expect(byUsers).toMatchObject({
            key: 7,
            label: "A Minecraft Movie",
            sublabel: "2025",
            value: 29,
            valueLabel: "29 users",
        });
        const [byPlays] = mapTopMediaToRows([movie], "plays", "movie", formatValueLabel);
        expect(byPlays.value).toBe(112);
        expect(byPlays.valueLabel).toBe("112 plays");
    });

    it("omits the sublabel when a movie has no year", () => {
        const [row] = mapTopMediaToRows([{ ...movie, year: null }], "plays", "movie", formatValueLabel);
        expect(row.sublabel).toBeUndefined();
    });

    it("leads with the show title for episodes and formats SxEx in the sublabel", () => {
        const [row] = mapTopMediaToRows([episode], "users", "episode", formatValueLabel);
        expect(row.label).toBe("Severance");
        expect(row.sublabel).toBe("S1E3 · Pilot");
    });

    it("falls back to S?E? and the episode title when show metadata is missing", () => {
        const bare = { ...episode, showTitle: null, seasonNumber: null, episodeNumber: null };
        const [row] = mapTopMediaToRows([bare], "users", "episode", formatValueLabel);
        expect(row.label).toBe("Pilot");
        expect(row.sublabel).toBe("S?E? · Pilot");
    });

    it("returns [] for undefined items", () => {
        expect(mapTopMediaToRows(undefined, "users", "movie", formatValueLabel)).toEqual([]);
    });
});

describe("buildThumbUrl", () => {
    it("passes null through", () => {
        expect(buildThumbUrl(null)).toBeNull();
    });

    it("URL-encodes both path and serverId", () => {
        expect(buildThumbUrl({ path: "/library/metadata/7/thumb?x=1&y=2", serverId: "srv/1" })).toBe(
            "/api/image?path=%2Flibrary%2Fmetadata%2F7%2Fthumb%3Fx%3D1%26y%3D2&serverId=srv%2F1",
        );
    });

    it("appends transcode dimensions when a size is given", () => {
        expect(buildThumbUrl({ path: "/thumb", serverId: "s" }, { w: 90, h: 135 })).toBe(
            "/api/image?path=%2Fthumb&serverId=s&w=90&h=135",
        );
    });

    it("rows request the small poster size", () => {
        const [row] = mapTopMediaToRows([movie], "users", "movie", formatValueLabel);
        expect(row.thumbSrc).toContain("&w=90&h=135");
    });
});

describe("STATS_PERIODS", () => {
    it("covers the unified page vocabulary", () => {
        expect(STATS_PERIODS.map((p) => p.days)).toEqual([1, 7, 30, 90, 365, ALL_TIME_DAYS]);
    });
});
