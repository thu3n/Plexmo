import { describe, expect, it } from "vitest";
import {
    MAX_VELOCITY_SAMPLES,
    VELOCITY_WINDOW_MS,
    decayVelocity,
    nearestOffset,
    pushSample,
    releaseVelocity,
    type VelocitySample,
} from "@/lib/drag-scroll-physics";

describe("pushSample", () => {
    it("drops samples older than the velocity window", () => {
        let samples: VelocitySample[] = [];
        samples = pushSample(samples, { time: 0, x: 0 });
        samples = pushSample(samples, { time: 70, x: 10 });
        samples = pushSample(samples, { time: VELOCITY_WINDOW_MS + 60, x: 20 });
        // t=0 is 160ms old (outside the 100ms window); t=70 is 90ms old (inside).
        expect(samples).toEqual([
            { time: 70, x: 10 },
            { time: VELOCITY_WINDOW_MS + 60, x: 20 },
        ]);
    });

    it("caps the buffer at MAX_VELOCITY_SAMPLES", () => {
        let samples: VelocitySample[] = [];
        for (let i = 0; i < MAX_VELOCITY_SAMPLES + 4; i++) {
            samples = pushSample(samples, { time: i, x: i });
        }
        expect(samples).toHaveLength(MAX_VELOCITY_SAMPLES);
        expect(samples[0].time).toBe(4);
    });
});

describe("releaseVelocity", () => {
    it("computes the slope over the sample window", () => {
        const samples: VelocitySample[] = [
            { time: 100, x: 0 },
            { time: 150, x: 25 },
            { time: 200, x: 50 },
        ];
        // 50px over 100ms = 0.5 px/ms
        expect(releaseVelocity(samples, 200)).toBeCloseTo(0.5);
    });

    it("is negative for a leftward flick", () => {
        const samples: VelocitySample[] = [
            { time: 0, x: 100 },
            { time: 40, x: 60 },
        ];
        expect(releaseVelocity(samples, 40)).toBeCloseTo(-1);
    });

    it("returns 0 with fewer than two samples", () => {
        expect(releaseVelocity([], 100)).toBe(0);
        expect(releaseVelocity([{ time: 90, x: 5 }], 100)).toBe(0);
    });

    it("excludes stale samples outside the window at release time", () => {
        const samples: VelocitySample[] = [
            { time: 0, x: 0 }, // stale: user held still, then flicked
            { time: 480, x: 0 },
            { time: 500, x: 40 },
        ];
        // Only the last two count: 40px / 20ms = 2 px/ms (not 40/500).
        expect(releaseVelocity(samples, 500)).toBeCloseTo(2);
    });

    it("returns 0 when all in-window samples share a timestamp", () => {
        const samples: VelocitySample[] = [
            { time: 500, x: 0 },
            { time: 500, x: 40 },
        ];
        expect(releaseVelocity(samples, 500)).toBe(0);
    });
});

describe("decayVelocity", () => {
    it("is frame-rate independent", () => {
        const oneBigStep = decayVelocity(2, 33.34);
        const twoSmallSteps = decayVelocity(decayVelocity(2, 16.67), 16.67);
        expect(oneBigStep).toBeCloseTo(twoSmallSteps, 10);
    });

    it("decays toward zero and preserves sign", () => {
        expect(decayVelocity(1, 1000)).toBeGreaterThan(0);
        expect(decayVelocity(1, 1000)).toBeLessThan(0.05);
        expect(decayVelocity(-1, 1000)).toBeLessThan(0);
    });
});

describe("nearestOffset", () => {
    it("picks the closest offset", () => {
        expect(nearestOffset([0, 100, 200], 130)).toBe(100);
        expect(nearestOffset([0, 100, 200], 160)).toBe(200);
    });

    it("keeps the first match on exact ties", () => {
        expect(nearestOffset([0, 100], 50)).toBe(0);
    });

    it("returns the target unchanged for empty input", () => {
        expect(nearestOffset([], 42)).toBe(42);
    });
});
