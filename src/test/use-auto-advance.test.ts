import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
    AUTO_ADVANCE_INTERVAL_MS,
    INTERACTION_PAUSE_MS,
    nextTickDelay,
    useAutoAdvance,
} from "@/features/stats/hooks/useAutoAdvance";

describe("nextTickDelay", () => {
    it("is the plain interval when no interaction is pending", () => {
        expect(nextTickDelay(50_000, 0, AUTO_ADVANCE_INTERVAL_MS)).toBe(AUTO_ADVANCE_INTERVAL_MS);
    });

    it("extends to the end of the interaction pause when that is later", () => {
        expect(nextTickDelay(1_000, 1_000, AUTO_ADVANCE_INTERVAL_MS)).toBe(INTERACTION_PAUSE_MS);
        expect(nextTickDelay(5_000, 1_000, AUTO_ADVANCE_INTERVAL_MS)).toBe(
            1_000 + INTERACTION_PAUSE_MS - 5_000,
        );
    });
});

describe("useAutoAdvance", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        // Restore the prototype getter if a test shadowed document.hidden.
        delete (document as { hidden?: boolean }).hidden;
    });

    it("advances every interval while unpaused", () => {
        const onAdvance = vi.fn();
        renderHook(() => useAutoAdvance<HTMLDivElement>({ enabled: true, onAdvance }));
        act(() => vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL_MS));
        expect(onAdvance).toHaveBeenCalledTimes(1);
        act(() => vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL_MS));
        expect(onAdvance).toHaveBeenCalledTimes(2);
    });

    it("does nothing when disabled", () => {
        const onAdvance = vi.fn();
        renderHook(() => useAutoAdvance<HTMLDivElement>({ enabled: false, onAdvance }));
        act(() => vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL_MS * 3));
        expect(onAdvance).not.toHaveBeenCalled();
    });

    it("defers the next advance for the full interaction pause", () => {
        const onAdvance = vi.fn();
        const { result } = renderHook(() =>
            useAutoAdvance<HTMLDivElement>({ enabled: true, onAdvance }),
        );
        act(() => result.current.pauseForInteraction());
        act(() => vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL_MS));
        expect(onAdvance).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(INTERACTION_PAUSE_MS - AUTO_ADVANCE_INTERVAL_MS - 1));
        expect(onAdvance).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("does not advance while the document is hidden, resumes on visibility", () => {
        let hidden = true;
        Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
        const onAdvance = vi.fn();
        renderHook(() => useAutoAdvance<HTMLDivElement>({ enabled: true, onAdvance }));
        act(() => vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL_MS * 3));
        expect(onAdvance).not.toHaveBeenCalled();

        hidden = false;
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        act(() => vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL_MS));
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("stops cleanly on unmount", () => {
        const onAdvance = vi.fn();
        const { unmount } = renderHook(() =>
            useAutoAdvance<HTMLDivElement>({ enabled: true, onAdvance }),
        );
        unmount();
        act(() => vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL_MS * 3));
        expect(onAdvance).not.toHaveBeenCalled();
    });
});
