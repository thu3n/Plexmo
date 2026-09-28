"use client";

import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { SkeletonRows } from "@/components/Skeleton";
import { useScrolled } from "@/lib/use-scrolled";
import { errorMessage } from "@/components/ui/Feedback";
import { useUsersDirectory } from "../hooks/useUsersDirectory";
import { UserCard } from "./UserCard";
import { UsersToolbar } from "./UsersToolbar";
import { UsersFilterChips } from "./UsersFilterChips";
import { UsersEmptyState } from "./UsersEmptyState";

/**
 * Canonical user directory: one card per identity (accountId) with server
 * memberships as badges. The dedup is display-only; storage stays per-server.
 */
export function UsersDirectory() {
    const { t } = useLanguage();
    const dir = useUsersDirectory();
    const scrolled = useScrolled();

    const renderBody = () => {
        // Keep showing cached cards if a background revalidation fails.
        if (dir.error && dir.totalUsers === 0) {
            return <UsersEmptyState kind="error" message={errorMessage(dir.error, "Request failed")} onRetry={dir.retry} />;
        }
        if (dir.totalUsers === 0) return <UsersEmptyState kind="empty" />;
        if (dir.matchedCount === 0) return <UsersEmptyState kind="noMatches" onReset={dir.resetFilters} />;
        return dir.shownUsers.map(({ user, activity }) => (
            <UserCard key={user.accountId} user={user} activity={activity} now={dir.now} />
        ));
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsSection
                title={t("settings.users")}
                description={t("settings.usersDesc")}
            >
                {/* Sticky on md+ only — the stacked mobile controls would eat
                    too much viewport under the settings header. */}
                <div
                    className={`flex flex-col md:flex-row gap-4 mb-4 md:sticky md:top-6 md:z-40 md:rounded-3xl md:transition-all md:duration-300 md:p-4 md:-mx-4 md:-mt-4 ${scrolled ? "md:bg-slate-950/95 md:shadow-2xl" : ""
                        }`}
                >
                    <UsersToolbar
                        servers={dir.servers}
                        filters={dir.filters}
                        sort={dir.sort}
                        setSearch={dir.setSearch}
                        changeServer={dir.changeServer}
                        setSort={dir.setSort}
                        syncFromPlex={dir.syncFromPlex}
                        isSyncing={dir.isSyncing}
                    />
                </div>

                <UsersFilterChips
                    filters={dir.filters}
                    toggleFilter={dir.toggleFilter}
                    matchedCount={dir.matchedCount}
                    totalUsers={dir.totalUsers}
                />

                {dir.isLoading ? (
                    <SkeletonRows count={4} rowClassName="h-24 rounded-2xl" />
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{renderBody()}</div>
                        {dir.hasMore && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    type="button"
                                    onClick={dir.showMore}
                                    className="rounded-xl bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    Show more ({dir.matchedCount - dir.shownUsers.length} remaining)
                                </button>
                            </div>
                        )}
                    </>
                )}
            </SettingsSection>
        </div>
    );
}
