"use client";

import type { ServerOption } from "./access-types";

/**
 * Optional server scoping for an access invite. Nothing ticked = every server
 * (the default equal-access policy); ticking narrows the viewer to those.
 */
export function ServerScopePicker({
    servers,
    selected,
    onChange,
    isLoading,
    error,
}: {
    servers: ServerOption[];
    selected: string[];
    onChange: (ids: string[]) => void;
    isLoading: boolean;
    error: unknown;
}) {
    const toggle = (id: string) =>
        onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

    return (
        <fieldset>
            <legend className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">
                Servers
            </legend>
            <p className="text-xs text-white/40 mb-2">
                {selected.length === 0 ? "All servers, including ones added later." : "Only the selected servers."}
            </p>
            {isLoading ? (
                <div className="h-10 animate-pulse rounded-xl bg-white/5" />
            ) : error ? (
                <p className="text-xs text-rose-400">Could not load servers; the invite will cover all servers.</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {servers.map((server) => {
                        const isOn = selected.includes(server.id);
                        return (
                            <button
                                key={server.id}
                                type="button"
                                aria-pressed={isOn}
                                onClick={() => toggle(server.id)}
                                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${isOn ? "bg-indigo-500 text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
                            >
                                {server.name}
                            </button>
                        );
                    })}
                </div>
            )}
        </fieldset>
    );
}
