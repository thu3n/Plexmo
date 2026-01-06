"use client";

import { useState, useEffect } from "react";

type FileItem = {
    name: string;
    type: "directory" | "file";
    path: string;
};

type FileResponse = {
    currentPath: string;
    parent: string | null;
    items: FileItem[];
};

interface FileBrowserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (path: string) => void;
    initialPath?: string;
}

export function FileBrowserModal({ isOpen, onClose, onSelect, initialPath }: FileBrowserModalProps) {
    const [currentPath, setCurrentPath] = useState(initialPath || "");
    const [data, setData] = useState<FileResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchPath(initialPath || "");
        }
    }, [isOpen]);

    const fetchPath = async (path: string) => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/filesystem?path=${encodeURIComponent(path)}`);
            if (!res.ok) throw new Error("Failed to load directory");
            const json = await res.json();
            setData(json);
            setCurrentPath(json.currentPath);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Select File</h3>
                    <button onClick={onClose} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>

                {/* Path Bar */}
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm text-white/70">
                    <span className="shrink-0 text-amber-500">Path:</span>
                    <span className="truncate font-mono">{currentPath}</span>
                </div>

                {/* File List */}
                <div className="mb-4 max-h-[400px] min-h-[300px] overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
                    {loading ? (
                        <div className="flex h-full items-center justify-center text-white/50">Loading...</div>
                    ) : error ? (
                        <div className="flex h-full items-center justify-center text-rose-400">{error}</div>
                    ) : (
                        <div className="mt-1 space-y-1">
                            {data?.parent && (
                                <button
                                    onClick={() => fetchPath(data.parent!)}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-indigo-400">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" className="rotate-45" />
                                    </svg>
                                    <span className="font-bold">..</span>
                                </button>
                            )}
                            {data?.items.map((item) => (
                                <button
                                    key={item.name}
                                    onClick={() => {
                                        if (item.type === "directory") {
                                            fetchPath(item.path);
                                        } else {
                                            onSelect(item.path);
                                            onClose();
                                        }
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10 group"
                                >
                                    {item.type === "directory" ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-400">
                                            <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c.414 0 .75-.336.75-.75v-.5a.75.75 0 00-.75-.75h-.25z" />
                                            <path fillRule="evenodd" d="M3 4.5a2.25 2.25 0 012.25-2.25h.25a2.25 2.25 0 012.25 2.25v.5a2.25 2.25 0 01-2.25 2.25h-.25A2.25 2.25 0 013 5v-.5zM3.75 7A1.5 1.5 0 002.25 8.5v7.25a1.5 1.5 0 001.5 1.5h12.5a1.5 1.5 0 001.5-1.5V8.5a1.5 1.5 0 00-1.5-1.5H3.75z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-slate-400 group-hover:text-white">
                                            <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V6.121a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.379 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    <span className="truncate">{item.name}</span>
                                </button>
                            ))}
                            {data?.items.length === 0 && (
                                <div className="py-4 text-center text-sm text-white/30">Unknown folder or empty</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/10"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
