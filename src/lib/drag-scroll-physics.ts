/**
 * Pure momentum math for drag-to-scroll (no DOM). Velocities are px/ms; time is ms.
 * Unit-tested in src/test/drag-scroll-physics.test.ts.
 */

export type VelocitySample = { time: number; x: number };

/** Only pointer samples this recent count toward the flick velocity at release. */
export const VELOCITY_WINDOW_MS = 100;
export const MAX_VELOCITY_SAMPLES = 8;
/** Glide decay factor per 60fps frame — applied frame-rate independently via decayVelocity. */
export const MOMENTUM_FRICTION_PER_FRAME = 0.94;
export const REFERENCE_FRAME_MS = 1000 / 60;
/** Releases slower than this don't glide at all — just settle/snap. */
export const MIN_GLIDE_VELOCITY_PX_PER_MS = 0.25;
/** A glide below this speed is considered finished. */
export const STOP_VELOCITY_PX_PER_MS = 0.03;

export function pushSample(samples: VelocitySample[], sample: VelocitySample): VelocitySample[] {
    const next = [...samples, sample].filter((s) => sample.time - s.time <= VELOCITY_WINDOW_MS);
    return next.slice(-MAX_VELOCITY_SAMPLES);
}

/** Pointer velocity (px/ms) over the in-window samples; 0 when there's nothing to measure. */
export function releaseVelocity(samples: VelocitySample[], releaseTime: number): number {
    const recent = samples.filter((s) => releaseTime - s.time <= VELOCITY_WINDOW_MS);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = last.time - first.time;
    if (dt === 0) return 0;
    return (last.x - first.x) / dt;
}

/** Exponential decay that gives identical results regardless of frame timing. */
export function decayVelocity(velocity: number, elapsedMs: number): number {
    return velocity * MOMENTUM_FRICTION_PER_FRAME ** (elapsedMs / REFERENCE_FRAME_MS);
}

/** Closest snap offset to `target`; returns `target` unchanged for empty input. */
export function nearestOffset(offsets: number[], target: number): number {
    if (offsets.length === 0) return target;
    let best = offsets[0];
    for (const offset of offsets) {
        if (Math.abs(offset - target) < Math.abs(best - target)) best = offset;
    }
    return best;
}
