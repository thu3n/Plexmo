import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import { ScrollStripArrows } from "@/components/ScrollStripArrows";
import { useDragScroll } from "@/lib/use-drag-scroll";

const makeScrollRef = () => {
    const el = { clientWidth: 1000, scrollBy: vi.fn() };
    return { ref: { current: el } as unknown as RefObject<HTMLElement | null>, el };
};

afterEach(cleanup);

describe("ScrollStripArrows", () => {
    it("shows both arrows mid-scroll and pages by a fraction of the viewport", () => {
        const { ref, el } = makeScrollRef();
        render(<ScrollStripArrows scrollRef={ref} edges={{ atStart: false, atEnd: false }} />);

        fireEvent.click(screen.getByLabelText("Scroll right"));
        expect(el.scrollBy).toHaveBeenCalledWith({ left: 800, behavior: "smooth" });

        fireEvent.click(screen.getByLabelText("Scroll left"));
        expect(el.scrollBy).toHaveBeenCalledWith({ left: -800, behavior: "smooth" });
    });

    it("hides the arrow at its own edge", () => {
        const { ref } = makeScrollRef();
        const { rerender } = render(
            <ScrollStripArrows scrollRef={ref} edges={{ atStart: true, atEnd: false }} />,
        );
        expect(screen.queryByLabelText("Scroll left")).toBeNull();
        expect(screen.queryByLabelText("Scroll right")).not.toBeNull();

        rerender(<ScrollStripArrows scrollRef={ref} edges={{ atStart: false, atEnd: true }} />);
        expect(screen.queryByLabelText("Scroll left")).not.toBeNull();
        expect(screen.queryByLabelText("Scroll right")).toBeNull();
    });

    it("renders nothing when the strip does not overflow", () => {
        const { ref } = makeScrollRef();
        const { container } = render(
            <ScrollStripArrows scrollRef={ref} edges={{ atStart: true, atEnd: true }} />,
        );
        expect(container.querySelectorAll("button")).toHaveLength(0);
    });
});

function DragStrip() {
    const { ref, handlers } = useDragScroll<HTMLDivElement>();
    return (
        <div ref={ref} {...handlers} data-testid="strip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/poster.jpg" alt="poster" />
        </div>
    );
}

describe("useDragScroll native drag suppression", () => {
    it("cancels dragstart so grabbing a poster image starts a scroll drag, not an HTML5 drag", () => {
        render(<DragStrip />);
        // fireEvent returns false when a handler called preventDefault.
        expect(fireEvent.dragStart(screen.getByAltText("poster"))).toBe(false);
    });
});
