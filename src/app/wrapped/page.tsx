import { Suspense } from "react";
import { WrappedClient } from "@/features/wrapped/components/WrappedClient";

export const metadata = {
    title: "Wrapped",
};

// useSearchParams (the ?user=&year= selection) needs a Suspense boundary.
export default function WrappedPage() {
    return (
        <Suspense>
            <WrappedClient />
        </Suspense>
    );
}
