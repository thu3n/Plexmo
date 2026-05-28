"use client";

import { useEffect, useMemo, useState } from "react";
import { SessionCard } from "@/features/dashboard/components/SessionCard";
import { SummaryCard } from "@/components/SummaryCard";
import { getServerColor } from "@/lib/serverColors";
import { useLanguage } from "@/components/LanguageContext";
import { UserMenu } from "@/components/UserMenu";
import type { SessionSummary } from "@/lib/plex";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { useRuleEnforcement } from "@/features/dashboard/hooks/useRuleEnforcement";
import { useDashboardStatistics } from "@/features/dashboard/hooks/useDashboardStatistics";




const renderInteractiveTags = (data: Record<string, { name: string; count: number }>) => (
  <div className="flex flex-wrap gap-2 mt-1">
    {Object.entries(data).map(([id, stats]) => (
      <div key={id} className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-medium text-white/70 whitespace-nowrap">
        {stats.name}: <span className="text-amber-400 font-bold ml-1">{stats.count}</span>
      </div>
    ))}
  </div>
);

export default function Home() {
  const { t } = useLanguage();

  const [scrolled, setScrolled] = useState(false);

  // Hook 1: Data Fetching
  const {
    sessions: allSessions,
    summary: serverSummary,
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
    directPlayPerServer,
    transcodePerServer,
    bandwidthPerServer
  } = useDashboardStatistics(allSessions, serverSummary || null, servers);

  const activeServerName =
    selectedServerId
      ? servers.find((server) => server.id === selectedServerId)?.name ?? t("common.unknown") + " " + t("session.server")
      : t("dashboard.all") + " " + t("settings.servers").toLowerCase();

  const handleSelectServer = (id: string | null) => {
    setSelectedServerId(id);
  };

  const formatBandwidth = (value: number) => {
    if (!value) return "0 Mbps";
    const mbps = value / 1000;
    return `${mbps.toFixed(1)} Mbps`;
  };


  return (
    <div className="relative min-h-screen">
      {/* Premium Background Blurs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute right-[-10%] top-0 h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[20%] h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      {/* Sticky Header */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b ${scrolled ? "bg-black/60 backdrop-blur-xl border-white/5 py-3" : "bg-transparent border-transparent py-5"
          }`}
      >
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/Plexmo_icon.png"
                alt="Plexmo"
                className="h-full w-full object-contain rounded-lg shadow-lg shadow-orange-500/20"
              />
            </div>
            <div>
              {appName ? (
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white/90">
                  {appName}
                </h1>
              ) : (
                <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Server Filters - Desktop */}
            {servers && servers.length > 0 && (
              <div className="hidden lg:flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5">
                <button
                  onClick={() => handleSelectServer(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedServerId === null
                    ? "bg-white text-black shadow-sm"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                >
                  {t("dashboard.all")}
                </button>
                {servers.map((server) => {
                  const isActive = selectedServerId === server.id;
                  const color = getServerColor(server.id, server.color);
                  const isUnreachable = server.status === "unreachable";
                  return (
                    <button
                      key={server.id}
                      onClick={() => handleSelectServer(isActive ? null : server.id)}
                      title={isUnreachable ? server.statusMessage : undefined}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${isActive
                        ? "text-white shadow-sm ring-1 ring-white/20"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                      style={{
                        backgroundColor: isActive ? color : 'transparent'
                      }}
                    >
                      {isUnreachable && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-amber-400">
                          <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                        </svg>
                      )}
                      {server.name}
                    </button>
                  );
                })}
              </div>
            )}

            <UserMenu align="top-right" />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 pt-24 pb-20">

        {/* Mobile Server Filter (Below Header) */}
        {servers && servers.length > 0 && (
          <div className="lg:hidden mb-6 flex overflow-x-auto pb-2 gap-2 no-scrollbar mask-linear-fade">
            <button
              onClick={() => handleSelectServer(null)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${selectedServerId === null
                ? "bg-white text-black border-white"
                : "bg-white/5 border-white/10 text-white/60"
                }`}
            >
              {t("dashboard.all")}
            </button>
            {servers.map((server) => {
              const isActive = selectedServerId === server.id;
              const color = getServerColor(server.id, server.color);
              const isUnreachable = server.status === "unreachable";
              return (
                <button
                  key={server.id}
                  onClick={() => handleSelectServer(isActive ? null : server.id)}
                  title={isUnreachable ? server.statusMessage : undefined}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-2 ${isActive
                    ? "text-white border-white/20 shadow-lg"
                    : "text-white/60 border-white/10 bg-white/5"
                    }`}
                  style={{
                    backgroundColor: isActive ? color : undefined,
                    borderColor: isActive ? color : undefined
                  }}
                >
                  {isUnreachable && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-amber-400">
                      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                    </svg>
                  )}
                  {server.name}
                </button>
              );
            })}
          </div>
        )}


        {/* Stats Grid - Horizontal Scroll on Mobile */}
        <section className="mb-10 w-full overflow-x-auto pb-4 snap-x snap-mandatory flex gap-4 md:grid md:grid-cols-4 md:overflow-visible md:pb-0 no-scrollbar">
          <div className="min-w-[85%] snap-center md:min-w-0">
            <SummaryCard
              label={t("dashboard.streams")}
              value={summary.active.toString()}
              detail={Object.keys(streamsPerServer).length > 0 ? renderInteractiveTags(streamsPerServer) : t("dashboard.noActiveSessions")}
              accent="text-amber-400"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M22 12C22 14.7578 20.8836 17.2549 19.0782 19.064M2 12C2 9.235 3.12222 6.73208 4.93603 4.92188M19.1414 5.00003C19.987 5.86254 20.6775 6.87757 21.1679 8.00003M5 19.1415C4.08988 18.2493 3.34958 17.1845 2.83209 16" />
                  <path d="M16.2849 8.04397C17.3458 9.05877 18 10.4488 18 11.9822C18 13.5338 17.3302 14.9386 16.2469 15.9564M7.8 16C6.68918 14.9789 6 13.556 6 11.9822C6 10.4266 6.67333 9.01843 7.76162 8" />
                  <path d="M13.6563 10.4511C14.5521 11.1088 15 11.4376 15 12C15 12.5624 14.5521 12.8912 13.6563 13.5489C13.4091 13.7304 13.1638 13.9014 12.9384 14.0438C12.7407 14.1688 12.5168 14.298 12.2849 14.4249C11.3913 14.914 10.9444 15.1586 10.5437 14.8878C10.1429 14.617 10.1065 14.0502 10.0337 12.9166C10.0131 12.596 10 12.2817 10 12C10 11.7183 10.0131 11.404 10.0337 11.0834C10.1065 9.94977 10.1429 9.38296 10.5437 9.1122C10.9444 8.84144 11.3913 9.08599 12.2849 9.57509C12.5168 9.70198 12.7407 9.83123 12.9384 9.95619C13.1638 10.0986 13.4091 10.2696 13.6563 10.4511Z" />
                </svg>
              }
            />
          </div>
          <div className="min-w-[85%] snap-center md:min-w-0">
            <SummaryCard
              label={t("dashboard.directPlay")}
              value={summary.directPlay.toString()}
              detail={Object.keys(directPlayPerServer).length > 0 ? renderInteractiveTags(directPlayPerServer) : t("dashboard.noTranscoding")}
              accent="text-emerald-400"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM10.6935 15.8458L15.4137 13.059C16.1954 12.5974 16.1954 11.4026 15.4137 10.941L10.6935 8.15419C9.93371 7.70561 9 8.28947 9 9.21316V14.7868C9 15.7105 9.93371 16.2944 10.6935 15.8458Z" />
                </svg>
              }
            />
          </div>
          <div className="min-w-[85%] snap-center md:min-w-0">
            <SummaryCard
              label={t("dashboard.transcode")}
              value={summary.transcoding.toString()}
              detail={Object.keys(transcodePerServer).length > 0 ? renderInteractiveTags(transcodePerServer) : t("dashboard.cpuChugging")}
              accent="text-rose-400"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M13.497 9.405h-2.86c-.612 0-1.11.503-1.11 1.12v2.81c0 .617.498 1.12 1.11 1.12h2.86c.611 0 1.109-.502 1.109-1.12v-2.81c0-.617-.498-1.12-1.11-1.12Zm3.613-5.892A.51.51 0 0 0 16.604 3a.51.51 0 0 0-.509.513V4.54h1.017V3.513Zm-1.806 0A.51.51 0 0 0 14.796 3a.51.51 0 0 0-.509.513V4.54h1.017V3.513Zm-1.807 0A.51.51 0 0 0 12.988 3a.51.51 0 0 0-.508.513V4.54h1.017V3.513Zm-1.807 0A.51.51 0 0 0 11.18 3a.51.51 0 0 0-.508.513V4.54h1.017V3.513Zm-1.808 0A.51.51 0 0 0 9.374 3a.51.51 0 0 0-.508.513V4.54h1.016V3.513Zm-1.807 0A.51.51 0 0 0 7.567 3a.51.51 0 0 0-.508.513V4.54h1.016V3.513ZM7.059 20.487a.51.51 0 0 0 .508.513.51.51 0 0 0 .508-.513V19.46H7.06v1.026Zm1.807 0a.51.51 0 0 0 .508.513.51.51 0 0 0 .508-.513V19.46H8.866v1.026Zm1.807 0a.51.51 0 0 0 .508.513.51.51 0 0 0 .509-.513V19.46h-1.017v1.026Zm1.807 0a.51.51 0 0 0 .508.513.51.51 0 0 0 .509-.513V19.46H12.48v1.026Zm1.807 0a.51.51 0 0 0 .508.513.51.51 0 0 0 .509-.513V19.46h-1.017v1.026Zm1.807 0a.51.51 0 0 0 .509.513.51.51 0 0 0 .508-.513V19.46h-1.017v1.026Zm4.398-4.61h-1.017v1.026h1.017A.51.51 0 0 0 21 16.39a.51.51 0 0 0-.508-.513Zm0-1.825h-1.017v1.027h1.017a.51.51 0 0 0 .508-.514.51.51 0 0 0-.508-.513Zm0-1.824h-1.017v1.026h1.017a.51.51 0 0 0 .508-.513.51.51 0 0 0-.508-.513Zm0-1.824h-1.017v1.026h1.017a.51.51 0 0 0 .508-.513.51.51 0 0 0-.508-.513Zm0-1.824h-1.017v1.026h1.017A.51.51 0 0 0 21 9.093a.51.51 0 0 0-.508-.514ZM21 7.268a.51.51 0 0 0-.508-.513h-1.017v1.026h1.017A.51.51 0 0 0 21 7.268Zm-18 0a.51.51 0 0 0 .508.513h1.017V6.755H3.508A.51.51 0 0 0 3 7.268Zm0 1.825a.51.51 0 0 0 .508.513h1.017V8.579H3.508A.51.51 0 0 0 3 9.093Zm0 1.824a.51.51 0 0 0 .508.513h1.017v-1.026H3.508a.51.51 0 0 0-.508.513Zm0 1.824a.51.51 0 0 0 .508.513h1.017v-1.026H3.508a.51.51 0 0 0-.508.513Zm0 1.824a.51.51 0 0 0 .508.514h1.017v-1.027H3.508a.51.51 0 0 0-.508.513Zm0 1.825a.51.51 0 0 0 .508.513h1.017v-1.026H3.508A.51.51 0 0 0 3 16.39Z" />
                </svg>
              }
            />
          </div>
          <div className="min-w-[85%] snap-center md:min-w-0">
            <SummaryCard
              label={t("dashboard.bandwidth")}
              value={formatBandwidth(summary.bandwidth)}
              detail={Object.keys(bandwidthPerServer).length > 0 ? renderInteractiveTags(bandwidthPerServer) : t("dashboard.networkLoad")}
              accent="text-cyan-400"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M17.7453 16C18.5362 14.8661 19 13.4872 19 12C19 11.4851 18.9444 10.9832 18.8389 10.5M6.25469 16C5.46381 14.8662 5 13.4872 5 12C5 8.13401 8.13401 5 12 5C12.4221 5 12.8355 5.03737 13.2371 5.10897M16.4999 7.5L11.9999 12M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM13 12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12Z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Sessions Section */}
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
              {t("dashboard.activeSessions")}
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
            </h2>
            <div className="h-px flex-1 bg-white/5 mx-4 hidden sm:block"></div>
          </div>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {error ? (
              <div className="col-span-full rounded-2xl glass-panel border border-rose-500/20 p-8 text-center text-rose-200">
                <p className="text-lg font-bold">{t("common.error")}</p>
                <p className="text-sm opacity-70 mt-1">{error.message}</p>
              </div>
            ) : null}

            {isLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-44 w-full animate-pulse rounded-2xl bg-white/5" />
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

            {filteredSessions.map((session, i) => {
              const serverObj = servers.find(s => s.id === session.serverId);
              const color = getServerColor(session.serverId, serverObj?.color);
              const isLimitExceeded = ruleViolations.has(session.user);
              return <SessionCard key={`${session.serverId}-${session.id}-${i}`} session={session} serverColor={color} isLimitExceeded={isLimitExceeded} />;
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
