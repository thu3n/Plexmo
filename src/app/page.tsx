"use client";

import { useEffect, useState } from "react";
import { SessionCard } from "@/features/dashboard/components/SessionCard";
import { SummaryCard } from "@/components/SummaryCard";
import {
  BandwidthIcon,
  DirectPlayIcon,
  DirectStreamIcon,
  StreamsIcon,
  TranscodeIcon,
} from "@/features/dashboard/components/DashboardIcons";
import { Skeleton, SkeletonStatCard } from "@/components/Skeleton";
import { getServerColor } from "@/lib/serverColors";
import type { PublicServer } from "@/lib/servers";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { edgeMaskClass, useScrollEdges } from "@/lib/use-scroll-edges";
import { useLanguage } from "@/components/LanguageContext";
import { UserMenu } from "@/components/UserMenu";
import { HeaderNav } from "@/components/HeaderNav";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { useRuleEnforcement } from "@/features/dashboard/hooks/useRuleEnforcement";
import { useDashboardStatistics } from "@/features/dashboard/hooks/useDashboardStatistics";




type ServerTagStats = { name: string; count: number; label?: string };

/**
 * Per-server tags inside the summary cards — since v1.8.2 these ARE the
 * server filter (the header pills are gone). Clicking a tag filters the
 * dashboard to that server; clicking the highlighted tag clears back to all.
 * Selection is global, so the chosen server highlights on every card. Also
 * the new home of the unreachable-server warning.
 */
function ServerTags({
  data,
  servers,
  selectedServerId,
  onSelect,
}: {
  data: Record<string, ServerTagStats>;
  servers: PublicServer[];
  selectedServerId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { ref: dragRef, handlers: dragHandlers } = useDragScroll<HTMLDivElement>();
  const edges = useScrollEdges(dragRef, [data]);
  return (
    <div
      ref={dragRef}
      {...dragHandlers}
      className={`flex gap-2 mt-1 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing ${edgeMaskClass(edges)}`}
    >
      {Object.entries(data)
        .sort(([, a], [, b]) => b.count - a.count)
        .map(([id, stats]) => {
        const server = servers.find((s) => s.id === id);
        const isActive = selectedServerId === id;
        const isUnreachable = server?.status === "unreachable";
        return (
          <button
            key={id}
            onClick={() => onSelect(isActive ? null : id)}
            aria-pressed={isActive}
            title={isUnreachable ? server?.statusMessage : undefined}
            className={`flex shrink-0 items-center px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${isActive
              ? "text-white ring-1 ring-white/20 shadow-sm"
              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              }`}
            style={{ backgroundColor: isActive ? getServerColor(id, server?.color) : undefined }}
          >
            {isUnreachable && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 mr-1 text-amber-400">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            )}
            {stats.name}:
            <span className={`font-bold ml-1 ${isActive ? "text-white" : "text-amber-400"}`}>
              {stats.label ?? stats.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
    directStreamPerServer,
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

  // Streams card lists every configured server (count 0 when idle) so idle
  // or unreachable servers stay visible and filterable.
  const streamsTagData: Record<string, ServerTagStats> = {
    ...Object.fromEntries(servers.map((s) => [s.id, { name: s.name, count: 0 }])),
    ...streamsPerServer,
  };

  const renderServerTags = (data: Record<string, ServerTagStats>) => (
    <ServerTags
      data={data}
      servers={servers}
      selectedServerId={selectedServerId}
      onSelect={handleSelectServer}
    />
  );

  const formatBandwidth = (value: number) => {
    if (!value) return "0 Mbps";
    const mbps = value / 1000;
    return `${mbps.toFixed(1)} Mbps`;
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

        {/* Stats Grid - Horizontal Scroll on Mobile */}
        <section className="mb-10 w-full overflow-x-auto pb-4 snap-x snap-mandatory flex gap-4 md:grid md:grid-cols-3 xl:grid-cols-5 md:overflow-visible md:pb-0 no-scrollbar">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="min-w-[85%] snap-center md:min-w-0">
                <SkeletonStatCard />
              </div>
            ))
          ) : (
            <>
          <div className="min-w-[85%] snap-center md:min-w-0">
            <SummaryCard
              label={t("dashboard.streams")}
              value={summary.active.toString()}
              detail={servers.length > 0 ? renderServerTags(streamsTagData) : t("dashboard.noActiveSessions")}
              accent="text-amber-400"
              icon={<StreamsIcon />}
            />
          </div>
          <div className="min-w-[85%] snap-center md:min-w-0">
            <SummaryCard
              label={t("dashboard.directPlay")}
              value={summary.directPlay.toString()}
              detail={Object.keys(directPlayPerServer).length > 0 ? renderServerTags(directPlayPerServer) : t("dashboard.noDirectPlay")}
              accent="text-emerald-400"
              icon={<DirectPlayIcon />}
            />
          </div>
          <div className="min-w-[85%] snap-center md:min-w-0">
            <SummaryCard
              label={t("dashboard.directStream")}
              value={(summary.directStream ?? 0).toString()}
              detail={Object.keys(directStreamPerServer).length > 0 ? renderServerTags(directStreamPerServer) : t("dashboard.noRemuxing")}
              accent="text-sky-400"
              icon={<DirectStreamIcon />}
            />
          </div>
          <div className="min-w-[85%] snap-center md:min-w-0">
            <SummaryCard
              label={t("dashboard.transcode")}
              value={summary.transcoding.toString()}
              detail={Object.keys(transcodePerServer).length > 0 ? renderServerTags(transcodePerServer) : t("dashboard.cpuChugging")}
              accent="text-rose-400"
              icon={<TranscodeIcon />}
            />
          </div>
          <div className="min-w-[85%] snap-center md:min-w-0">
            <SummaryCard
              label={t("dashboard.bandwidth")}
              value={formatBandwidth(summary.bandwidth)}
              detail={Object.keys(bandwidthPerServer).length > 0 ? renderServerTags(bandwidthPerServer) : t("dashboard.networkLoad")}
              accent="text-cyan-400"
              icon={<BandwidthIcon />}
            />
          </div>
            </>
          )}
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
