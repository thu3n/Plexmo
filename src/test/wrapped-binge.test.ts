import { describe, expect, it } from "vitest";
import { BINGE_GAP_MS, findLongestBinge, type BingeRow } from "@/lib/stats/wrapped-binge";

const MIN = 60_000;
const EP = 40 * MIN;

/** Episode `mediaId` of `show`, starting at `start` and lasting one episode. */
const ep = (show: number, mediaId: number, start: number): BingeRow => ({
    startTime: start,
    stopTime: start + EP,
    mediaId,
    showMediaId: show,
    showTitle: `Show ${show}`,
    seconds: EP / 1000,
});

describe("findLongestBinge", () => {
    it("counts back-to-back episodes of one show", () => {
        const rows = [ep(1, 11, 0), ep(1, 12, EP + 5 * MIN), ep(1, 13, 2 * EP + 10 * MIN)];
        expect(findLongestBinge(rows)).toMatchObject({
            showMediaId: 1,
            episodes: 3,
            seconds: (3 * EP) / 1000,
            startedAt: 0,
            endedAt: 3 * EP + 10 * MIN,
        });
    });

    it("splits on a gap longer than the limit", () => {
        const rows = [ep(1, 11, 0), ep(1, 12, EP + BINGE_GAP_MS + 1), ep(1, 13, 2 * EP + BINGE_GAP_MS + 2)];
        expect(findLongestBinge(rows)?.episodes).toBe(2);
    });

    it("splits when another show is watched in between", () => {
        const rows = [ep(1, 11, 0), ep(2, 21, EP), ep(1, 12, 2 * EP), ep(2, 22, 3 * EP), ep(2, 23, 4 * EP)];
        expect(findLongestBinge(rows)).toMatchObject({ showMediaId: 2, episodes: 2 });
    });

    it("does not count a rewatched episode twice", () => {
        const rows = [ep(1, 11, 0), ep(1, 11, EP), ep(1, 11, 2 * EP)];
        expect(findLongestBinge(rows)).toBeNull();
    });

    it("breaks ties on episodes by watch time", () => {
        const short = { ...ep(1, 11, 0), seconds: 60 };
        const rows = [short, { ...ep(1, 12, EP), seconds: 60 }, ep(2, 21, 10 * EP), ep(2, 22, 11 * EP)];
        expect(findLongestBinge(rows)?.showMediaId).toBe(2);
    });

    it("returns null with nothing to binge", () => {
        expect(findLongestBinge([])).toBeNull();
        expect(findLongestBinge([ep(1, 11, 0)])).toBeNull();
    });
});
