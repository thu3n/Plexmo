import { HistoryEntry } from "@/lib/history";

export interface BundleResult {
    type: 'bundle' | 'single';
    entry: any; // Using any for compatibility with existing code where explicit types might vary
    subEntries: any[];
}

export function bundleHistoryEntries(entries: any[], options: { skipItemCheck?: boolean } = {}): BundleResult[] {
    const bundles: BundleResult[] = [];
    if (!entries.length) return bundles;

    let currentBundle: any[] = [entries[0]];

    for (let i = 1; i < entries.length; i++) {
        const prev = currentBundle[0];
        const curr = entries[i];

        // Criteria for bundling: Same User, Same Item (ratingKey), Same Date (approx)
        // We'll use a 12-hour window or just "Same Day" window?
        // The requirements say "Multiple viewing sessions ... on the same day".
        // Let's stick to: Same User AND Same RatingKey AND Same Server AND Same Day.

        const prevDate = new Date(prev.startTime).toLocaleDateString('en-CA');
        const currDate = new Date(curr.startTime).toLocaleDateString('en-CA');

        // Check compatibility of objects (handle different shapes if necessary, but assuming similar)
        const isSameUser = String(prev.user) === String(curr.user);

        // For distinct episodes, we must check ratingKey. For merged movies, we might skip it (handled by options).
        const isSameItem = options.skipItemCheck ? true : String(prev.ratingKey) === String(curr.ratingKey);

        // Remove ServerID check to allow cross-server bundling in Unified Groups
        // const isSameServer = String(prev.serverId) === String(curr.serverId);

        const isSameDay = prevDate === currDate;

        if (isSameUser && isSameItem && isSameDay) {
            currentBundle.push(curr);
        } else {
            // Push current bundle
            if (currentBundle.length > 1) {
                bundles.push({
                    type: 'bundle',
                    entry: currentBundle[0], // Use latest as representative (assuming desc sort)
                    subEntries: currentBundle
                });
            } else {
                bundles.push({
                    type: 'single',
                    entry: currentBundle[0],
                    subEntries: []
                });
            }
            currentBundle = [curr];
        }
    }

    // Push last bundle
    if (currentBundle.length > 0) {
        if (currentBundle.length > 1) {
            bundles.push({
                type: 'bundle',
                entry: currentBundle[0],
                subEntries: currentBundle
            });
        } else {
            bundles.push({
                type: 'single',
                entry: currentBundle[0],
                subEntries: []
            });
        }
    }

    return bundles;
}
