"use client";

import { LibraryValueSection } from "../library/LibraryValueSection";
import type { StatsScope } from "./types";

/**
 * Is the library earning its disk space? Lifetime metrics over the current
 * library, so only the server filter applies — a 30-day window would label
 * most of the library unplayed.
 */
export function LibrarySection({ scope }: { scope: StatsScope }) {
    return <LibraryValueSection serverId={scope.serverId} />;
}
