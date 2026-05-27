import clsx from "clsx";

interface ScopeTabProps {
    activeScopeTab: "servers" | "users";
    setActiveScopeTab: (tab: "servers" | "users") => void;
    ruleServers?: any[];
    ruleUsers?: any[];
    search: string;
    setSearch: (value: string) => void;
    toggleRuleServer: (serverId: string, enabled: boolean) => void;
    toggleRuleUser: (userId: string, enabled: boolean) => void;
}

/**
 * Scope tab: assign the rule to specific users or entire servers. With no
 * selection the rule is treated as global (applies to everyone).
 */
export default function ScopeTab({
    activeScopeTab,
    setActiveScopeTab,
    ruleServers,
    ruleUsers,
    search,
    setSearch,
    toggleRuleServer,
    toggleRuleUser,
}: ScopeTabProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <button
                    onClick={() => setActiveScopeTab("users")}
                    className={clsx(
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                        activeScopeTab === "users" ? "bg-amber-500 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                >
                    Specific Users
                </button>
                <button
                    onClick={() => setActiveScopeTab("servers")}
                    className={clsx(
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                        activeScopeTab === "servers" ? "bg-amber-500 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                >
                    Entire Servers
                </button>
            </div>

            {activeScopeTab === "servers" && (
                <div className="space-y-2">
                    {ruleServers?.map((server: any) => (
                        <div key={server.serverId} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                            <span className="text-sm font-medium text-white">{server.name}</span>
                            <label className="flex items-center cursor-pointer relative">
                                <input
                                    type="checkbox"
                                    checked={server.enabled}
                                    onChange={(e) => toggleRuleServer(server.serverId, e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:bg-amber-500/80 transition-all duration-200"></div>
                                <div className="absolute left-[2px] top-[2px] bg-white w-4 h-4 rounded-full transition-all duration-200 peer-checked:translate-x-full shadow-sm"></div>
                            </label>
                        </div>
                    ))}
                </div>
            )}

            {activeScopeTab === "users" && (
                <div className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search users..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-4 py-2 text-sm text-white focus:outline-none focus:border-white/20 placeholder:text-white/20"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                        {ruleUsers?.filter((u: any) => u.username.toLowerCase().includes(search.toLowerCase())).map((user: any) => (
                            <div key={user.userId} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-white truncate">{user.username}</div>
                                    <div className="text-xs text-white/40 truncate">{user.email || user.serverNames}</div>
                                </div>
                                <label className="flex items-center cursor-pointer relative ml-4 shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={user.enabled}
                                        onChange={(e) => toggleRuleUser(user.userId, e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:bg-indigo-500/80 transition-all duration-200"></div>
                                    <div className="absolute left-[2px] top-[2px] bg-white w-4 h-4 rounded-full transition-all duration-200 peer-checked:translate-x-full shadow-sm"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
