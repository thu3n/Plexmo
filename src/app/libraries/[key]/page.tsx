"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageContext";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState, Suspense } from "react";


const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
};

import { use } from "react";

export default function LibraryPage({ params }: { params: Promise<{ key: string }> }) {
    const { key } = use(params);
    const searchParams = useSearchParams();
    const router = useRouter();
    const serverId = searchParams.get("server");
    const { t } = useLanguage();

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [searchQuery, setSearchQuery] = useState("");

    const { data, error, isLoading } = useSWR<{ items: any[], totalCount: number, server?: { baseUrl: string, token: string } }>(
        serverId ? `/api/libraries/${key}/items?server=${serverId}&page=${page}&pageSize=${pageSize}&search=${searchQuery}` : null,
        fetchJson,
        { refreshInterval: 0, keepPreviousData: true }
    );

    const totalCount = data?.totalCount || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    if (!serverId) {
        return (
            <div className="flex h-screen items-center justify-center text-white">
                <p>Missing Server ID</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500/30">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-5%] top-[-10%] h-80 w-80 rounded-full bg-amber-400/10 blur-3xl opacity-40" />
                <div className="absolute right-[-10%] top-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl opacity-30" />
            </div>

            <main className="relative z-10 mx-auto max-w-7xl px-6 py-12">
                <header className="mb-8 flex items-center justify-between">
                    <Link
                        href="/settings/servers?tab=libraries"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 hover:border-white/20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                        </svg>
                        {t("common.back")}
                    </Link>
                    <h1 className="text-2xl font-bold">Library Items</h1>
                </header>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">

                    {/* Pagination Controls (Sticky) */}
                    <div className="sticky top-0 z-20 -mx-8 -mt-8 px-8 py-6 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 rounded-t-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-white/50 font-medium">
                            {totalCount > 0 ? (
                                <span>Showing <span className="text-white font-bold">{((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)}</span> of <span className="text-white font-bold">{totalCount}</span> items</span>
                            ) : (
                                <span>No items found</span>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none [&>option]:bg-slate-900"
                            >
                                {[25, 50, 100, 250].map(size => (
                                    <option key={size} value={size}>{size} / page</option>
                                ))}
                            </select>

                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-48 bg-black/20 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:w-64 transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1 border border-white/10">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || isLoading}
                                    className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-4 text-xs font-bold font-mono min-w-[80px] text-center">
                                    {isLoading ? "..." : `${page} / ${totalPages || 1}`}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages || isLoading}
                                    className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />
                    {isLoading ? (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-white/5" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-rose-400">Failed to load items.</p>
                        </div>
                    ) : (data?.items?.length ?? 0) === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-white/50">No items found in this library. Try syncing it explicitly from Settings.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {data?.items.map((item) => (
                                <div
                                    key={item.ratingKey}
                                    className="group flex flex-col gap-2"
                                >
                                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-900 shadow-lg transition group-hover:scale-105 group-hover:shadow-2xl ring-1 ring-white/10">
                                        {item.thumb && data?.server ? (
                                            <img
                                                src={`${data.server.baseUrl}${item.thumb}?X-Plex-Token=${data.server.token}`}
                                                alt={item.title}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    // Fallback to title if image fails
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement?.querySelector('.fallback-title')?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white/20 font-bold">
                                                {item.title.charAt(0)}
                                            </div>
                                        )}
                                        {/* Fallback title (hidden by default if image exists) */}
                                        <div className={`fallback-title absolute inset-0 flex items-center justify-center bg-slate-800 text-white/20 font-bold ${item.thumb ? 'hidden' : ''}`}>
                                            {item.title.charAt(0)}
                                        </div>

                                        {/* Hover Details Overlay */}
                                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-none">
                                            <div className="text-xs text-white/70 break-all">
                                                <p className="font-bold text-white mb-1">File Path</p>
                                                {item.filePath ? (
                                                    <span className="font-mono text-[10px] leading-tight block">{item.filePath}</span>
                                                ) : (
                                                    <span className="italic opacity-50">Unknown</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate font-medium text-white text-sm" title={item.title}>{item.title}</p>
                                        <p className="text-xs text-white/40">{item.year}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>


            </main>
        </div>
    );
}
