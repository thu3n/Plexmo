import { describe, it, expect, beforeAll, vi } from "vitest";
import { SRV_A, SRV_B } from "./fixtures/v1-seed";

vi.mock("@/lib/db", async () => {
    const { createTestDb, migrateTo } = await import("@/test/db-helper");
    const { seedV1Fixture } = await import("@/test/fixtures/v1-seed");
    const db = createTestDb(1);
    seedV1Fixture(db);
    migrateTo(db);
    return { db };
});

import { db } from "@/lib/db";
import { getLibrariesData } from "@/lib/library/libraries-query";

const SHARED_GUID = "plex://episode/shared-across-servers";

const seedLibraries = () => {
    const section = db.prepare(
        `INSERT INTO library_sections (serverId, sectionKey, title, type, itemCount, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
    );
    section.run(SRV_A, "1", "Movies", "movie", 2, "2026-07-15T00:00:00Z");
    section.run(SRV_A, "2", "Shows", "show", 1, "2026-07-15T00:00:00Z");
    section.run(SRV_B, "5", "Shows", "show", 1, "2026-07-15T00:00:00Z");

    const item = db.prepare(
        `INSERT INTO library_items (serverId, ratingKey, sectionKey, mediaId, type, title, year, addedAt, thumb, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    item.run(SRV_A, "m1", "1", 1, "movie", "Movie One", 2020, 3000, "/library/metadata/m1/thumb/1", 1);
    item.run(SRV_A, "m2", "1", null, "movie", "Movie Two", 2021, 2000, null, 1);
    // Same canonical show on both servers -> 1 unique title, 2 copies.
    item.run(SRV_A, "s1", "2", 10, "show", "Show", 2019, 1000, null, 1);
    item.run(SRV_B, "s9", "5", 10, "show", "Show", 2019, 4000, "/library/metadata/s9/thumb/1", 1);

    const episode = db.prepare(
        `INSERT INTO library_episodes (serverId, ratingKey, sectionKey, guid) VALUES (?, ?, ?, ?)`
    );
    episode.run(SRV_A, "e1", "2", SHARED_GUID);
    episode.run(SRV_A, "e2", "2", "plex://episode/only-a");
    episode.run(SRV_A, "e3", "2", null);
    episode.run(SRV_B, "x1", "5", SHARED_GUID);
    episode.run(SRV_B, "x2", "5", "plex://episode/only-b");
    episode.run(SRV_B, "x3", "5", null);
};

beforeAll(seedLibraries);

describe("getLibrariesData", () => {
    it("counts episodes per section (unique within a section by construction)", () => {
        const { sections } = getLibrariesData();
        expect(sections).toHaveLength(3);

        const byKey = new Map(sections.map((s) => [`${s.serverId}:${s.sectionKey}`, s]));
        expect(byKey.get(`${SRV_A}:1`)?.episodeCount).toBe(0);
        expect(byKey.get(`${SRV_A}:2`)?.episodeCount).toBe(3);
        expect(byKey.get(`${SRV_B}:5`)?.episodeCount).toBe(3);
    });

    it("dedupes the global unique-episode count on guid, with per-server fallback for NULL", () => {
        const { uniqueEpisodes } = getLibrariesData();
        // 6 copies; SHARED_GUID counts once, two distinct guids, two NULL-guid
        // rows fall back to per-server keys -> 5 unique.
        expect(uniqueEpisodes.totalCopies).toBe(6);
        expect(uniqueEpisodes.uniqueCount).toBe(5);
    });

    it("counts unique titles on canonical mediaId", () => {
        const { uniqueTitles } = getLibrariesData();
        const shows = uniqueTitles.find((u) => u.type === "show");
        const movies = uniqueTitles.find((u) => u.type === "movie");
        expect(shows).toMatchObject({ uniqueCount: 1, totalCopies: 2 });
        expect(movies).toMatchObject({ uniqueCount: 2, totalCopies: 2 });
    });

    it("returns recently added as unique titles, newest copy first", () => {
        const { recentlyAdded } = getLibrariesData();
        // s1/s9 share mediaId 10 — the older copy (s1) is deduped away.
        expect(recentlyAdded).toHaveLength(3);
        expect(recentlyAdded.map((r) => r.ratingKey)).toEqual(["s9", "m1", "m2"]);
        expect(recentlyAdded.some((r) => r.ratingKey === "s1")).toBe(false);
        expect(recentlyAdded[0].addedAt).toBe(4000);
        expect(recentlyAdded[0].thumb).toBe("/library/metadata/s9/thumb/1");
        expect(recentlyAdded[2].thumb).toBeNull();
    });

    it("scopes every result set to allowedServerIds", () => {
        const scoped = getLibrariesData([SRV_A]);
        expect(scoped.sections.every((s) => s.serverId === SRV_A)).toBe(true);
        expect(scoped.sections).toHaveLength(2);
        expect(scoped.uniqueEpisodes).toMatchObject({ uniqueCount: 3, totalCopies: 3 });
        expect(scoped.recentlyAdded.every((r) => r.serverId === SRV_A)).toBe(true);
        // Dedup happens after scope filtering — s1 survives when s9 is out of scope.
        expect(scoped.recentlyAdded.map((r) => r.ratingKey)).toEqual(["m1", "m2", "s1"]);
        const shows = scoped.uniqueTitles.find((u) => u.type === "show");
        expect(shows).toMatchObject({ uniqueCount: 1, totalCopies: 1 });
    });
});
