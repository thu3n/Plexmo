import { describe, it, expect, beforeEach, vi } from "vitest";
import { SRV_A } from "./fixtures/v1-seed";

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
import { syncSectionEpisodes } from "@/lib/library/episode-sync";

const SERVER = { id: SRV_A, name: "Alpha", baseUrl: "http://alpha.local:32400", token: "token-a" };
const SECTION = "2";

type MockEpisode = { ratingKey?: string; guid?: string };

const page = (episodes: MockEpisode[], totalSize: number) => ({
    MediaContainer: { size: episodes.length, totalSize, Video: episodes },
});

const countRows = () =>
    (db.prepare("SELECT COUNT(*) as count FROM library_episodes WHERE serverId = ? AND sectionKey = ?")
        .get(SRV_A, SECTION) as { count: number }).count;

beforeEach(() => {
    plexFetchMock.mockReset();
    db.prepare("DELETE FROM library_episodes").run();
});

describe("syncSectionEpisodes", () => {
    it("paginates until totalSize is reached, advancing X-Plex-Container-Start", async () => {
        plexFetchMock
            .mockResolvedValueOnce(page([{ ratingKey: "e1", guid: "plex://episode/1" }, { ratingKey: "e2", guid: "plex://episode/2" }], 3))
            .mockResolvedValueOnce(page([{ ratingKey: "e3" }], 3));

        const count = await syncSectionEpisodes(SERVER, SECTION);

        expect(count).toBe(3);
        expect(countRows()).toBe(3);
        expect(plexFetchMock).toHaveBeenCalledTimes(2);
        expect(plexFetchMock.mock.calls[0][1]).toMatchObject({ type: 4, "X-Plex-Container-Start": 0 });
        expect(plexFetchMock.mock.calls[1][1]).toMatchObject({ "X-Plex-Container-Start": 2 });

        // Episode without a guid string is stored with NULL guid.
        const e3 = db.prepare("SELECT guid FROM library_episodes WHERE ratingKey = 'e3'").get() as { guid: string | null };
        expect(e3.guid).toBeNull();
    });

    it("replaces the section wholesale — stale rows vanish on re-sync", async () => {
        plexFetchMock.mockResolvedValueOnce(
            page([{ ratingKey: "e1", guid: "g1" }, { ratingKey: "e2", guid: "g2" }], 2)
        );
        await syncSectionEpisodes(SERVER, SECTION);
        expect(countRows()).toBe(2);

        plexFetchMock.mockResolvedValueOnce(page([{ ratingKey: "e2", guid: "g2" }], 1));
        await syncSectionEpisodes(SERVER, SECTION);
        expect(countRows()).toBe(1);
    });

    it("keeps the previous inventory when a later page fails mid-flight", async () => {
        plexFetchMock.mockResolvedValueOnce(page([{ ratingKey: "e1", guid: "g1" }], 1));
        await syncSectionEpisodes(SERVER, SECTION);
        expect(countRows()).toBe(1);

        plexFetchMock
            .mockResolvedValueOnce(page([{ ratingKey: "n1", guid: "g9" }], 2))
            .mockRejectedValueOnce(new Error("timeout"));

        await expect(syncSectionEpisodes(SERVER, SECTION)).rejects.toThrow("timeout");
        // Old row untouched, half-fetched batch never written.
        expect(countRows()).toBe(1);
        const survivor = db.prepare("SELECT ratingKey FROM library_episodes").get() as { ratingKey: string };
        expect(survivor.ratingKey).toBe("e1");
    });

    it("terminates on an empty page even if totalSize lies", async () => {
        plexFetchMock.mockResolvedValueOnce(page([], 100));
        const count = await syncSectionEpisodes(SERVER, SECTION);
        expect(count).toBe(0);
        expect(plexFetchMock).toHaveBeenCalledTimes(1);
    });
});
