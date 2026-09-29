"use client";

import { useEffect, useState } from "react";
import { SessionCard } from "@/features/dashboard/components/SessionCard";
import { BandwidthCard, StreamsOverviewCard } from "@/features/dashboard/components/DashboardStatCards";
import { ServerFilterBar } from "@/features/dashboard/components/ServerFilterBar";
import { Skeleton, SkeletonStatCard } from "@/components/Skeleton";
import { getServerColor } from "@/lib/serverColors";
import { useLanguage } from "@/components/LanguageContext";
import { UserMenu } from "@/components/UserMenu";
import { HeaderNav } from "@/components/HeaderNav";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { useRuleEnforcement } from "@/features/dashboard/hooks/useRuleEnforcement";
import { useDashboardStatistics } from "@/features/dashboard/hooks/useDashboardStatistics";

export default function Home() {
  const { t } = useLanguage();

  const [scrolled, setScrolled] = useState(false);

  // Hook 1: Data Fetching
  const {
    sessions: allSessions,
    appName,
    servers,
    isLoading,
    error,
  } = useDashboardData();

  // Hook 2: Rule Enforcement
  const { ruleViolations } = useRuleEnforcement(allSessions);

  // Monitor scroll for header styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Hook 3: Statistics Aggregation
  const {
    selectedServerId,
    filteredSessions,
    summary,
    setSelectedServerId,
    streamsPerServer,
  } = useDashboardStatistics(allSessions, servers);

  const activeServerName =
    selectedServerId
      ? servers.find((server) => server.id === selectedServerId)?.name ?? t("common.unknown") + " " + t("session.server")
      : t("dashboard.all") + " " + t("settings.servers").toLowerCase();

  const handleSelectServer = (id: string | null) => {
    setSelectedServerId(id);
  };

  return (
    <div className="relative min-h-dvh">
      {/* Premium background orbs. Radial gradients, NOT filter blurs — a blurred
          solid circle and a radial falloff look the same, but 120px gaussian
          filters forced iOS WebKit to resample them under every glass layer and
          were a core driver of the dashboard render lag. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.10),transparent)]" />
        <div className="absolute right-[-10%] top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(168,85,247,0.10),transparent)]" />
        <div className="absolute bottom-[-10%] left-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.05),transparent)]" />
      </div>

      {/* Sticky Header — safe-top adds the iPhone notch height so it doesn't slide under the status bar */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b safe-top ${scrolled ? "bg-black/80 border-white/5" : "bg-transparent border-transparent"
          }`}
      >
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/Plexmo_icon.png"
                alt="Plexmo"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>
            <div>
              {appName ? (
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white/90">
                  {appName}
                </h1>
              ) : (
                <Skeleton className="h-6 w-32 rounded" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <HeaderNav />
            <UserMenu align="top-right" />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 main-safe-top pb-dock">

        {/* Stats: streams + how they are delivered, bandwidth by LAN/WAN, then
            the server filter once for the whole dashboard. */}
        <section className="mb-10 flex flex-col gap-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            {isLoading ? (
              <>
                <SkeletonStatCard className="lg:col-span-2 h-[172px]" />
                <SkeletonStatCard className="h-[172px]" />
              </>
            ) : (
              <>
                <StreamsOverviewCard summary={summary} className="lg:col-span-2" />
                <BandwidthCard summary={summary} />
              </>
            )}
          </div>
          {!isLoading && servers.length > 0 ? (
            <ServerFilterBar
              label={t("settings.servers")}
              data={streamsPerServer}
              servers={servers}
              selectedServerId={selectedServerId}
              onSelect={handleSelectServer}
            />
          ) : null}
        </section>

        {/* Sessions Section */}
        <div className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {error ? (
              <div className="col-span-full rounded-2xl glass-panel border border-rose-500/20 p-8 text-center text-rose-200">
                <p className="text-lg font-bold">{t("common.error")}</p>
                <p className="text-sm opacity-70 mt-1">{error.message}</p>
              </div>
            ) : null}

            {isLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-44 w-full rounded-2xl" />
              ))
            ) : null}

            {!isLoading && filteredSessions.length === 0 && !error ? (
              <div className="col-span-full flex min-h-[400px] flex-col items-center justify-center rounded-3xl glass-panel p-10 text-center">
                <div className="rounded-full bg-white/5 p-6 mb-4 shadow-inner ring-1 ring-white/5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white/30">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-white/90">{t("dashboard.quiet")}</h3>
                <p className="text-sm text-white/40 max-w-sm mt-2">{t("dashboard.quietDesc").replace("{server}", activeServerName)}</p>
              </div>
            ) : null}

            {filteredSessions.map((session) => {
              const serverObj = servers.find(s => s.id === session.serverId);
              const color = getServerColor(session.serverId, serverObj?.color);
              const isLimitExceeded = ruleViolations.has(session.user);
              // Stable key (no list index) so reorders reuse the memoized cards
              // instead of remounting them.
              return <SessionCard key={`${session.serverId}-${session.sessionId || session.id}`} session={session} serverColor={color} isLimitExceeded={isLimitExceeded} />;
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
