import { describe, expect, it } from "vitest";
import { EDGE_EPSILON_PX, computeScrollEdges, edgeMaskClass } from "@/lib/use-scroll-edges";

describe("computeScrollEdges", () => {
    it("detects the start position", () => {
        expect(computeScrollEdges(0, 500, 2000)).toEqual({ atStart: true, atEnd: false });
    });

    it("detects the end position", () => {
        expect(computeScrollEdges(1500, 500, 2000)).toEqual({ atStart: false, atEnd: true });
    });

    it("detects a mid-scroll position", () => {
        expect(computeScrollEdges(700, 500, 2000)).toEqual({ atStart: false, atEnd: false });
    });

    it("treats non-overflowing content as both edges (no fade)", () => {
        expect(computeScrollEdges(0, 500, 400)).toEqual({ atStart: true, atEnd: true });
        expect(computeScrollEdges(0, 500, 500)).toEqual({ atStart: true, atEnd: true });
    });

    it("tolerates sub-pixel drift within the epsilon", () => {
        expect(computeScrollEdges(EDGE_EPSILON_PX, 500, 2000).atStart).toBe(true);
        expect(computeScrollEdges(EDGE_EPSILON_PX + 1, 500, 2000).atStart).toBe(false);
        expect(computeScrollEdges(1500 - EDGE_EPSILON_PX, 500, 2000).atEnd).toBe(true);
        expect(computeScrollEdges(1500 - EDGE_EPSILON_PX - 1, 500, 2000).atEnd).toBe(false);
    });
});

describe("edgeMaskClass", () => {
    it("covers all four edge states", () => {
        expect(edgeMaskClass({ atStart: true, atEnd: true })).toBe("");
        expect(edgeMaskClass({ atStart: true, atEnd: false })).toBe("mask-fade-right");
        expect(edgeMaskClass({ atStart: false, atEnd: true })).toBe("mask-fade-left");
        expect(edgeMaskClass({ atStart: false, atEnd: false })).toBe("mask-fade-both");
    });
});
