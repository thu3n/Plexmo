const WIDTH = 44;
const HEIGHT = 22;
/** Longer series are downsampled — a 44px sparkline can't show more detail anyway. */
const MAX_POINTS = 30;

export function Sparkline({ values, color = "#3b82f6" }: { values: number[]; color?: string }) {
    const step = Math.max(1, Math.ceil(values.length / MAX_POINTS));
    const points = values.filter((_, i) => i % step === 0);
    const max = Math.max(...points, 1);
    const min = Math.min(...points);
    const range = max - min || 1;
    const coords = points
        .map((v, i) => `${(i / (points.length - 1)) * WIDTH},${HEIGHT - ((v - min) / range) * HEIGHT}`)
        .join(" ");

    return (
        <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mb-1 shrink-0 overflow-visible" aria-hidden>
            <polyline points={coords} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
    );
}
