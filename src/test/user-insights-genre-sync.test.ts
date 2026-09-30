// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

const plexFetchMock = vi.fn();
vi.mock("@/lib/plex/plex-client", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/plex/plex-client")>();
    return { ...actual, plexFetch: (...args: unknown[]) => plexFetchMock(...args) };
});

import { db } from "@/lib/db";
import { parser } from "@/lib/plex/plex-client";
import { syncServerLibraries } from "@/lib/library/library-sync";
import { MAX_GENRES_PER_ITEM, MAX_GENRE_LENGTH, parsePlexGenres } from "@/lib/library/library-genres";

const SERVER = { id: "srv-a", name: "Alpha", baseUrl: "http://alpha.local:32400", token: "token-a" };

const SECTIONS = { MediaContainer: { Directory: [{ key: "1", title: "Movies", type: "movie" }] } };

/** Route the two listing calls the sync makes: sections, then the section's items. */
const serve = (items: unknown[]) =>
    plexFetchMock.mockImplementation(async (path: string) =>
        path === "/library/sections" ? SECTIONS : { MediaContainer: { Video: items } },
    );

const genresOf = (ratingKey: string) =>
    (db.prepare("SELECT genre FROM library_item_genres WHERE serverId = 'srv-a' AND ratingKey = ? ORDER BY genre")
        .all(ratingKey) as { genre: string }[]).map((r) => r.genre);

beforeEach(() => {
    plexFetchMock.mockReset();
    // Each sync must get a later syncedAt, or the vanished-item sweep sees nothing to delete.
    let clock = Date.UTC(2026, 6, 20);
    vi.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
    for (const table of ["library_items", "library_sections", "library_item_genres", "media_items", "media_sources"]) {
        db.prepare(`DELETE FROM ${table}`).run();
    }
});

describe("parsePlexGenres", () => {
    it("reads the parsed Plex XML shape (single tag and repeated tags)", () => {
        const single = parser.parse('<Video ratingKey="1"><Genre tag="Drama"/></Video>').Video;
        const many = parser.parse('<Video ratingKey="1"><Genre tag="Crime"/><Genre tag="Science &amp; Fiction"/></Video>').Video;
        expect(parsePlexGenres(single)).toEqual(["Drama"]);
        expect(parsePlexGenres(many)).toEqual(["Crime", "Science & Fiction"]);
    });

    it("drops malformed, empty, oversized and duplicate tags", () => {
        const item = {
            Genre: [
                { tag: "Drama" },
                { tag: " Drama " },
                { tag: "" },
                { tag: { nested: true } },
                null,
                "Action",
                { tag: "x".repeat(MAX_GENRE_LENGTH + 1) },
                { tag: 1917 },
            ],
        };
        expect(parsePlexGenres(item)).toEqual(["Drama", "1917"]);
        expect(parsePlexGenres(null)).toEqual([]);
        expect(parsePlexGenres({ Genre: "Drama" })).toEqual([]);
    });

    it("caps the number of genres per item", () => {
        const item = { Genre: Array.from({ length: MAX_GENRES_PER_ITEM + 5 }, (_, i) => ({ tag: `G${i}` })) };
        expect(parsePlexGenres(item)).toHaveLength(MAX_GENRES_PER_ITEM);
    });
});

describe("library sync genre storage", () => {
    it("stores genres per item and replaces them on re-sync", async () => {
        serve([
            { ratingKey: "1", type: "movie", title: "Heat", Genre: [{ tag: "Crime" }, { tag: "Drama" }] },
            { ratingKey: "2", type: "movie", title: "Up", Genre: { tag: "Animation" } },
            { ratingKey: "3", type: "movie", title: "No Genres" },
        ]);
        await syncServerLibraries(SERVER);
        expect(genresOf("1")).toEqual(["Crime", "Drama"]);
        expect(genresOf("2")).toEqual(["Animation"]);
        expect(genresOf("3")).toEqual([]);

        serve([
            { ratingKey: "1", type: "movie", title: "Heat", Genre: { tag: "Thriller" } },
            { ratingKey: "2", type: "movie", title: "Up", Genre: { tag: "Animation" } },
        ]);
        await syncServerLibraries(SERVER);
        expect(genresOf("1")).toEqual(["Thriller"]);
        // Item 3 vanished from Plex: its library row goes, and nothing orphaned remains.
        const orphans = db.prepare(`
            SELECT COUNT(*) AS n FROM library_item_genres g
            WHERE NOT EXISTS (SELECT 1 FROM library_items li WHERE li.serverId = g.serverId AND li.ratingKey = g.ratingKey)
        `).get() as { n: number };
        expect(orphans.n).toBe(0);
    });

    it("prunes genres of items removed between syncs", async () => {
        serve([
            { ratingKey: "1", type: "movie", title: "Heat", Genre: { tag: "Crime" } },
            { ratingKey: "2", type: "movie", title: "Up", Genre: { tag: "Animation" } },
        ]);
        await syncServerLibraries(SERVER);
        serve([{ ratingKey: "1", type: "movie", title: "Heat", Genre: { tag: "Crime" } }]);
        await syncServerLibraries(SERVER);
        expect(genresOf("2")).toEqual([]);
        expect(genresOf("1")).toEqual(["Crime"]);
    });
});
