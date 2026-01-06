import type { PublicServer } from "@/lib/servers";
import { useLanguage } from "./LanguageContext";
import { formatDate } from "@/lib/format";

export const ServerCard = ({
    server,
    onEdit,
    onDelete,
}: {
    server: PublicServer;
    onEdit: (server: PublicServer) => void;
    onDelete: (id: string) => void;
}) => {
    const { t } = useLanguage();
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10 hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-200">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-6 h-6"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h9.45a3.375 3.375 0 012.7 1.35L20.7 8.55a4.5 4.5 0 011.2 2.7m-18 0h18"
                            />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{server.name}</h3>
                        <p className="text-xs text-white/50 font-mono truncate max-w-[150px]">
                            {server.baseUrl}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onEdit(server)}
                        className="rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                        title={t("common.edit")}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                            />
                        </svg>
                    </button>
                    <button
                        onClick={() => onDelete(server.id)}
                        className="rounded-lg p-2 text-white/40 transition hover:bg-rose-500/20 hover:text-rose-400"
                        title={t("common.delete")}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
                <div
                    className={`h-2 w-2 rounded-full ${server.hasToken ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                />
                <span className={server.hasToken ? "text-emerald-200" : "text-rose-200"}>
                </span>
                <span className="text-white/20">•</span>
                <span className="text-white/40">
                    {(() => {
                        try {
                            return `${t("common.added")} ${formatDate(server.createdAt)}`;
                        } catch {
                            return `${t("common.added")} ${t("common.unknown")}`;
                        }
                    })()}
                </span>
            </div>
        </div>
    );
};
