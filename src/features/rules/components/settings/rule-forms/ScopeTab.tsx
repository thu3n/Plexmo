import { useState } from "react";
import type { RuleServerAssignment, RuleUserAssignment } from "@/features/rules/types";
import RuleSwitch from "../ui/RuleSwitch";
import SegmentedTabs, { tabId, tabPanelId } from "../ui/SegmentedTabs";

type ScopeView = "users" | "servers";

const SCOPE_TABS = [
    { value: "users" as const, label: "Specific Users" },
    { value: "servers" as const, label: "Entire Servers" },
];

const SCOPE_TABS_ID = "rule-scope";

interface ScopeTabProps {
    users?: RuleUserAssignment[];
    servers?: RuleServerAssignment[];
    error?: Error;
    isGlobal: boolean;
    toggleUser: (userId: string, enabled: boolean) => void;
    toggleServer: (serverId: string, enabled: boolean) => void;
}

/**
 * Scope tab: assign the rule to specific users or entire servers. With no
 * selection the rule is treated as global (applies to everyone). Changes are
 * staged and committed with the rest of the rule on Save.
 */
export default function ScopeTab({ users, servers, error, isGlobal, toggleUser, toggleServer }: ScopeTabProps) {
    const [view, setView] = useState<ScopeView>("users");
    const [search, setSearch] = useState("");
    const q = search.trim().toLowerCase();
    const visibleUsers = users?.filter((u) => u.username.toLowerCase().includes(q));

    return (
        <div className="space-y-4">
            <SegmentedTabs
                tabs={SCOPE_TABS}
                value={view}
                onChange={setView}
                label="Scope type"
                idBase={SCOPE_TABS_ID}
                className="max-w-xs"
                tabClassName="flex-1 px-3 py-1.5 text-xs"
            />

            <p className="text-xs text-white/40" aria-live="polite">
                {isGlobal
                    ? "No users or servers selected: this rule applies to everyone."
                    : "This rule applies only to the selected users and servers."}
            </p>

            {error && <p role="alert" className="text-sm text-rose-400">Could not load assignments: {error.message}</p>}

            <div role="tabpanel" id={tabPanelId(SCOPE_TABS_ID, view)} aria-labelledby={tabId(SCOPE_TABS_ID, view)}>
                {view === "servers" && (
                    <ul className="space-y-2">
                        {servers?.map((server) => (
                            <li key={server.serverId} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                <span className="text-sm font-medium text-white">{server.name}</span>
                                <RuleSwitch
                                    size="sm"
                                    checked={server.enabled}
                                    onChange={(on) => toggleServer(server.serverId, on)}
                                    label={`Apply to server ${server.name}`}
                                    activeClassName="bg-amber-500/80"
                                />
                            </li>
                        ))}
                        {servers?.length === 0 && <li className="text-sm text-white/40 p-3">No servers found.</li>}
                    </ul>
                )}

                {view === "users" && (
                    <div className="space-y-4">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search users..."
                            aria-label="Search users"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-white/20 placeholder:text-white/20"
                        />
                        <ul className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                            {visibleUsers?.map((user) => (
                                <li key={user.userId} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-white truncate">{user.username}</div>
                                        <div className="text-xs text-white/40 truncate">{user.email || user.serverNames}</div>
                                    </div>
                                    <div className="ml-4 shrink-0">
                                        <RuleSwitch
                                            size="sm"
                                            checked={user.enabled}
                                            onChange={(on) => toggleUser(user.userId, on)}
                                            label={`Apply to ${user.username}`}
                                            activeClassName="bg-indigo-500/80"
                                        />
                                    </div>
                                </li>
                            ))}
                            {visibleUsers?.length === 0 && <li className="text-sm text-white/40 p-2">No users match.</li>}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
