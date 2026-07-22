"use client";

import {
    useEffect,
    useRef,
    type DragEvent as ReactDragEvent,
    type PointerEvent as ReactPointerEvent,
    type MouseEvent as ReactMouseEvent,
} from "react";
import {
    MIN_GLIDE_VELOCITY_PX_PER_MS,
    STOP_VELOCITY_PX_PER_MS,
    decayVelocity,
    nearestOffset,
    pushSample,
    releaseVelocity,
    type VelocitySample,
} from "@/lib/drag-scroll-physics";

// Movement below this many pixels still counts as a click, not a drag.
const DRAG_THRESHOLD_PX = 5;
// Safari has no "scrollend" — restore scroll-snap after the settle via this fallback.
const SNAP_RESTORE_FALLBACK_MS = 500;

/**
 * Mouse drag-to-scroll for horizontal scroll containers — the touch-style
 * "hold and swipe" gesture on desktop. Touch input is ignored (it already
 * pans natively). Once a drag passes the threshold, the click that fires on
 * release is suppressed in capture phase so buttons inside the strip don't
 * trigger from a drag.
 *
 * Feel: scroll-snap is suspended while dragging (so the browser can't fight
 * every pointermove), a flick release glides out with friction, and snapping
 * containers then settle smoothly onto the nearest snap child before snap is
 * restored. `prefers-reduced-motion` skips the glide and settles instantly.
 *
 * Spread the returned handlers onto the scroll container:
 *   const { ref, handlers } = useDragScroll<HTMLDivElement>();
 *   <div ref={ref} {...handlers} className="overflow-x-auto cursor-grab active:cursor-grabbing">
 */
export function useDragScroll<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const state = useRef({ dragging: false, dragged: false, startX: 0, startScrollLeft: 0 });
    const samples = useRef<VelocitySample[]>([]);
    const glideFrame = useRef(0);
    const snap = useRef({ overridden: false, hadSnap: false, prevInline: "" });
    const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const removeScrollEndListener = useRef<(() => void) | null>(null);

    const prefersReducedMotion = () =>
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cancelGlide = () => {
        if (glideFrame.current) {
            cancelAnimationFrame(glideFrame.current);
            glideFrame.current = 0;
        }
    };

    const cancelPendingRestore = () => {
        if (restoreTimer.current) {
            clearTimeout(restoreTimer.current);
            restoreTimer.current = null;
        }
        removeScrollEndListener.current?.();
        removeScrollEndListener.current = null;
    };

    const restoreSnap = () => {
        cancelPendingRestore();
        if (snap.current.overridden && ref.current) {
            ref.current.style.scrollSnapType = snap.current.prevInline;
        }
        snap.current.overridden = false;
    };

    /** Settle a snapping container onto its nearest child, then re-enable snap. */
    const finishSnap = () => {
        const el = ref.current;
        if (!el || !snap.current.overridden) return;
        const containerLeft = el.getBoundingClientRect().left;
        const offsets = Array.from(el.children).map(
            (child) => child.getBoundingClientRect().left - containerLeft + el.scrollLeft,
        );
        el.scrollTo({
            left: nearestOffset(offsets, el.scrollLeft),
            behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
        // Restore only after the programmatic settle, otherwise snap re-engages mid-move.
        const onScrollEnd = () => restoreSnap();
        el.addEventListener("scrollend", onScrollEnd, { once: true });
        removeScrollEndListener.current = () => el.removeEventListener("scrollend", onScrollEnd);
        restoreTimer.current = setTimeout(restoreSnap, SNAP_RESTORE_FALLBACK_MS);
    };

    /** Inertial glide after a flick release; hands off to finishSnap when it dies out. */
    const startGlide = (pointerVelocity: number) => {
        const el = ref.current;
        if (!el) return;
        let velocity = pointerVelocity;
        // Track a float position — el.scrollLeft rounds, and re-reading it each frame
        // would accumulate the rounding into a visible stutter.
        let position = el.scrollLeft;
        const maxScroll = el.scrollWidth - el.clientWidth;
        let lastTime = performance.now();
        const step = (now: number) => {
            glideFrame.current = 0;
            const elapsed = now - lastTime;
            lastTime = now;
            // Pointer moving right scrolls content left, hence the subtraction.
            position -= velocity * elapsed;
            velocity = decayVelocity(velocity, elapsed);
            const clamped = Math.min(Math.max(position, 0), maxScroll);
            el.scrollLeft = clamped;
            if (clamped !== position || Math.abs(velocity) < STOP_VELOCITY_PX_PER_MS) {
                finishSnap();
                return;
            }
            glideFrame.current = requestAnimationFrame(step);
        };
        glideFrame.current = requestAnimationFrame(step);
    };

    const onPointerDown = (event: ReactPointerEvent<T>) => {
        if (event.pointerType !== "mouse" || !ref.current) return;
        // Grabbing a gliding/settling row stops it where it is.
        cancelGlide();
        cancelPendingRestore();
        samples.current = [];
        state.current = {
            dragging: true,
            dragged: false,
            startX: event.clientX,
            startScrollLeft: ref.current.scrollLeft,
        };
    };

    const onPointerMove = (event: ReactPointerEvent<T>) => {
        if (!state.current.dragging || !ref.current) return;
        const el = ref.current;
        const dx = event.clientX - state.current.startX;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX && !state.current.dragged) {
            state.current.dragged = true;
            el.setPointerCapture(event.pointerId);
            // Suspend scroll-snap for the drag — snap re-targeting on every scrollLeft
            // write is what made dragging feel choppy.
            if (!snap.current.overridden) {
                const computed = getComputedStyle(el).scrollSnapType;
                snap.current.hadSnap = computed !== "" && computed !== "none";
                if (snap.current.hadSnap) {
                    snap.current.prevInline = el.style.scrollSnapType;
                    el.style.scrollSnapType = "none";
                    snap.current.overridden = true;
                }
            }
        }
        if (state.current.dragged) {
            el.scrollLeft = state.current.startScrollLeft - dx;
            samples.current = pushSample(samples.current, {
                time: event.timeStamp,
                x: event.clientX,
            });
        }
    };

    const endDrag = (event: ReactPointerEvent<T>) => {
        if (state.current.dragged && ref.current?.hasPointerCapture(event.pointerId)) {
            ref.current.releasePointerCapture(event.pointerId);
        }
        const wasDragged = state.current.dragging && state.current.dragged;
        state.current.dragging = false;
        // `dragged` stays true until the click fires so onClickCapture can eat it.
        if (!wasDragged) return;
        const velocity = releaseVelocity(samples.current, event.timeStamp);
        if (Math.abs(velocity) >= MIN_GLIDE_VELOCITY_PX_PER_MS && !prefersReducedMotion()) {
            startGlide(velocity);
        } else {
            finishSnap();
        }
    };

    const onClickCapture = (event: ReactMouseEvent<T>) => {
        if (!state.current.dragged) return;
        state.current.dragged = false;
        event.preventDefault();
        event.stopPropagation();
    };

    // Images are natively draggable — without this, pressing on a poster and
    // moving starts an HTML5 image drag that swallows the pointer stream, so
    // drag-to-scroll only worked in the gaps between cards.
    const onDragStart = (event: ReactDragEvent<T>) => event.preventDefault();

    useEffect(() => {
        return () => {
            cancelGlide();
            restoreSnap();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        ref,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onClickCapture,
            onDragStart,
        },
    };
}
