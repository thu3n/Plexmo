
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { Plus, Trash2, Edit2, Check, X, Layers, Eye, RefreshCw } from "lucide-react";
import { SettingsCard } from "../../components/SettingsComponents";
import clsx from "clsx";
import type { LibrarySection } from "@/lib/plex";
import type { LibraryGroup } from "@/lib/library_groups";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed");
    return response.json();
};

export function LibraryGroupsManager({ libraries, onSync, isSyncing }: { libraries: LibrarySection[], onSync: () => void, isSyncing: boolean }) {
    const router = useRouter();
    const { data: groups, mutate } = useSWR<LibraryGroup[]>("/api/library-groups", fetchJson);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [name, setName] = useState("");
    const [type, setType] = useState<"movie" | "show">("movie");
    const [selectedLibs, setSelectedLibs] = useState<string[]>([]); // Array of "serverId:libraryKey"

    const resetForm = () => {
        setName("");
        setType("movie");
        setSelectedLibs([]);
        setIsCreating(false);
        setEditingId(null);
    };

    const handleEdit = (group: LibraryGroup) => {
        setName(group.name);
        setType(group.type);
        const libs = group.libraries?.map(l => `${l.server_id}:${l.library_key}`) || [];
        setSelectedLibs(libs);
        setEditingId(group.id);
    };

    const handleSubmit = async () => {
        if (!name || selectedLibs.length === 0) return;

        const mappedLibs = selectedLibs.map(s => {
            const [serverId, key] = s.split(":");
            const lib = libraries.find(l => l.serverId === serverId && l.key === key);
            return {
                key: lib!.key,
                serverId: lib!.serverId,
                serverName: lib!.serverName || "Unknown"
            };
        });

        const url = editingId ? `/api/library-groups/${editingId}` : "/api/library-groups";
        const method = editingId ? "PUT" : "POST";

        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, type, libraries: mappedLibs })
        });
        mutate();
        resetForm();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this group?")) return;
        await fetch(`/api/library-groups/${id}`, { method: "DELETE" });
        mutate();
    };

    // Group libraries by server for the selector
    const librariesByServer = libraries.reduce((acc, lib) => {
        const sName = lib.serverName || "Unknown";
        if (!acc[sName]) acc[sName] = [];
        acc[sName].push(lib);
        return acc;
    }, {} as Record<string, LibrarySection[]>);

    // Sort groups: Movies first, then by Name
    const sortedGroups = [...(groups || [])].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'movie' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="space-y-6">

            <div className="flex items-center justify-end">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onSync}
                        disabled={isSyncing}
                        className={clsx(
                            "p-2 rounded-lg transition-colors",
                            isSyncing ? "text-amber-500 bg-amber-500/10 cursor-not-allowed" : "text-white/50 hover:text-white hover:bg-white/10"
                        )}
                        title="Sync Libraries"
                    >
                        <RefreshCw className={clsx("w-4 h-4", isSyncing && "animate-spin")} />
                    </button>
                    {/* Button Removed - Moved to Grid */}
                </div>
            </div>



            {(isCreating || editingId) && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                            <h4 className="font-bold text-white text-lg">{editingId ? "Edit Group" : "New Unified Group"}</h4>
                            <button onClick={resetForm} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs text-white/50 font-bold uppercase">Group Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                                    placeholder="e.g. All Movies"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-white/50 font-bold uppercase">Content Type</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className={clsx(
                                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                        type === 'movie' ? "bg-indigo-500/10 border-indigo-500/50" : "bg-black/20 border-white/5 hover:border-white/10"
                                    )}>
                                        <input type="radio" checked={type === 'movie'} onChange={() => setType('movie')} className="sr-only" />
                                        <div className={clsx("w-4 h-4 rounded-full border flex items-center justify-center", type === 'movie' ? "border-indigo-500" : "border-white/30")}>
                                            {type === 'movie' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                                        </div>
                                        <span className={clsx("font-medium", type === 'movie' ? "text-white" : "text-white/60")}>Movies</span>
                                    </label>
                                    <label className={clsx(
                                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                        type === 'show' ? "bg-indigo-500/10 border-indigo-500/50" : "bg-black/20 border-white/5 hover:border-white/10"
                                    )}>
                                        <input type="radio" checked={type === 'show'} onChange={() => setType('show')} className="sr-only" />
                                        <div className={clsx("w-4 h-4 rounded-full border flex items-center justify-center", type === 'show' ? "border-indigo-500" : "border-white/30")}>
                                            {type === 'show' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                                        </div>
                                        <span className={clsx("font-medium", type === 'show' ? "text-white" : "text-white/60")}>TV Shows</span>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-white/50 font-bold uppercase">Select Source Libraries</label>
                                <div className="bg-black/40 rounded-xl p-2 max-h-60 overflow-y-auto border border-white/5 custom-scrollbar">
                                    {Object.keys(librariesByServer).length === 0 && (
                                        <div className="p-8 text-center text-white/30 text-sm">No libraries found.</div>
                                    )}
                                    {Object.entries(librariesByServer).map(([serverName, libs]) => {
                                        const visibleLibs = libs.filter(l => l.type === type);
                                        if (visibleLibs.length === 0) return null;

                                        return (
                                            <div key={serverName} className="mb-2 last:mb-0">
                                                <h5 className="text-[10px] font-bold text-white/30 uppercase tracking-wider px-3 py-2 sticky top-0 bg-slate-900/95 backdrop-blur z-10">{serverName}</h5>
                                                <div className="space-y-1 px-2">
                                                    {visibleLibs.map(lib => {
                                                        const id = `${lib.serverId}:${lib.key}`;
                                                        const isSelected = selectedLibs.includes(id);
                                                        return (
                                                            <label key={id} className={clsx(
                                                                "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                                                                isSelected ? "bg-indigo-500/20" : "hover:bg-white/5"
                                                            )}>
                                                                <div className={clsx(
                                                                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                                                    isSelected ? "bg-indigo-500 border-indigo-500" : "border-white/20 bg-black/20"
                                                                )}>
                                                                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) setSelectedLibs([...selectedLibs, id]);
                                                                            else setSelectedLibs(selectedLibs.filter(x => x !== id));
                                                                        }}
                                                                        className="sr-only"
                                                                    />
                                                                </div>
                                                                <span className={clsx("text-sm", isSelected ? "text-white font-medium" : "text-white/70")}>{lib.title}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 pt-0 flex justify-end gap-3">
                            <button onClick={resetForm} className="px-5 py-2.5 rounded-xl hover:bg-white/10 text-white/70 text-sm font-medium transition-colors">Cancel</button>
                            <button
                                onClick={handleSubmit}
                                disabled={!name || selectedLibs.length === 0}
                                className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                {editingId ? "Save Changes" : "Create Group"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedGroups.map(group => (
                    <SettingsCard
                        key={group.id}
                        className="group/card relative min-h-[160px] !p-6"
                        onClick={() => router.push(`/settings/libraries/group/${group.id}`)}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10">
                                <img
                                    src={`/images/libraries/${group.type === 'show' ? 'show' : 'movie'}.svg`}
                                    alt={group.type}
                                    className="w-full h-full object-contain opacity-80 group-hover/card:opacity-100 transition-opacity"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Link
                                    href={`/settings/libraries/group/${group.id}`}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                    title="View Content"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Eye className="w-4 h-4" />
                                </Link>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(group);
                                    }}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                    title="Edit Group"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(group.id);
                                    }}
                                    className="p-2 rounded-lg hover:bg-rose-500/20 text-white/20 hover:text-rose-400 transition-colors"
                                    title="Delete Group"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <h4 className="font-bold text-white text-lg mb-1">{group.name}</h4>


                        <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-2">
                            {group.libraries?.map(lib => (
                                <div key={lib.library_key + lib.server_id} className="text-xs text-white/60 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                                    <span className="truncate">
                                        {lib.server_name} <span className="opacity-50">•</span> {libraries.find(l => l.key === lib.library_key && l.serverId === lib.server_id)?.title || "Unknown Lib"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </SettingsCard>
                ))}

                {/* Add Group Card */}
                {!isCreating && !editingId && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="group flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-white/10 bg-white/5 p-6 transition hover:border-amber-400 hover:bg-white/10"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 transition group-hover:bg-amber-400 group-hover:text-slate-900">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="font-bold text-white group-hover:text-amber-400 transition-colors">Create Group</span>
                    </button>
                )}
            </div>
        </div>
    );
}
