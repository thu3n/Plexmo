"use client";

import { AlertTriangle, Users, SearchX } from "lucide-react";

type Props =
    | { kind: "error"; message: string; onRetry: () => void }
    | { kind: "empty" }
    | { kind: "noMatches"; onReset: () => void };

const BUTTON = "mt-4 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors";

/** The three ways the directory can show no cards, told apart for the user. */
export function UsersEmptyState(props: Props) {
    if (props.kind === "error") {
        return (
            <div role="alert" className="col-span-full py-12 text-center text-rose-200">
                <AlertTriangle className="mx-auto mb-3 w-8 h-8 text-rose-400" aria-hidden />
                <p className="font-medium">Couldn&apos;t load users.</p>
                <p className="text-sm text-white/40 mt-1">{props.message}</p>
                <button type="button" onClick={props.onRetry} className={BUTTON}>
                    Retry
                </button>
            </div>
        );
    }

    if (props.kind === "empty") {
        return (
            <div className="col-span-full py-12 text-center text-white/50">
                <Users className="mx-auto mb-3 w-8 h-8 text-white/30" aria-hidden />
                <p>No users yet. Users appear here once your Plex servers have shared users or history.</p>
            </div>
        );
    }

    return (
        <div className="col-span-full py-12 text-center text-white/50">
            <SearchX className="mx-auto mb-3 w-8 h-8 text-white/30" aria-hidden />
            <p>No users match your filters.</p>
            <button type="button" onClick={props.onReset} className={BUTTON}>
                Reset filters
            </button>
        </div>
    );
}
