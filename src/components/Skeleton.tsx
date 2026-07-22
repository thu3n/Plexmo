/**
 * Shared loading placeholders. Skeletons replace real content 1:1 while data
 * loads, so size them to match the element they stand in for — mismatched
 * heights cause layout shift when data arrives.
 */

export function Skeleton({ className = "" }: { className?: string }) {
    return <div aria-hidden className={`animate-pulse rounded-lg bg-white/5 ${className}`} />;
}

/** Mirrors the stat-card idiom (SummaryCard / libraries stat cards). */
export function SkeletonStatCard({ className = "" }: { className?: string }) {
    return (
        <div aria-hidden className={`rounded-2xl glass-panel border border-white/5 p-5 ${className}`}>
            <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-white/5" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/5" />
        </div>
    );
}

export function SkeletonRows({
    count = 5,
    rowClassName = "h-16 rounded-xl",
}: {
    count?: number;
    rowClassName?: string;
}) {
    return (
        <div aria-hidden className="space-y-3">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className={`animate-pulse bg-white/5 ${rowClassName}`} />
            ))}
        </div>
    );
}
