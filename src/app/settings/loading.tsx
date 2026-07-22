import { Skeleton } from "@/components/Skeleton";

// Route-level Suspense fallback: commits a cheap dark frame the instant a
// navigation lands instead of blocking the tap on the destination's full
// client tree — keeps rapid dock navigation responsive on iOS WebKit.
export default function Loading() {
    return (
        <div className="min-h-dvh flex items-center justify-center">
            <Skeleton className="h-10 w-10 rounded-full" />
        </div>
    );
}
