import { Logger } from "../../logger";
import type { PlexServerConfig, PlexSession } from "../../plex";
import type { PersistedRuleInstance } from "../types";
import { logRuleEvent, closeRuleEvent, updateRuleEventDetails } from "../rules-assignments";
import { getActiveStreamRow, getOpenEvents, type RuleScope } from "./context";
import { terminateWithNotify } from "./terminate";

const normalizeIp = (ip: string) => {
  if (ip === "::1") return "127.0.0.1";
  if (ip && ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");
  return ip;
};

const countsAsSingleLocation = (sessions: PlexSession[], limit: number): boolean => {
  const uniqueIps = new Set(
    sessions
      .map((s) => s.ip)
      .filter(Boolean)
      .map((ip) => normalizeIp(ip as string))
  );
  return uniqueIps.size <= limit;
};

/**
 * Kill selection: everything, or the newest streams by actual wall-clock start
 * time from active_sessions. NEVER by sessionKey — those are per-server
 * counters and meaningless across servers.
 */
const selectSessionsToKill = (
  sessions: PlexSession[],
  limit: number,
  killAll: boolean
): PlexSession[] => {
  if (killAll) return [...sessions];
  const ordered = [...sessions].sort(
    (a, b) => (getActiveStreamRow(a)?.startTime ?? 0) - (getActiveStreamRow(b)?.startTime ?? 0)
  );
  const killCount = sessions.length - limit;
  return ordered.slice(-killCount);
};

export const enforceConcurrentStreams = async (
  instance: PersistedRuleInstance,
  scope: RuleScope,
  serverConfigMap: Map<string, PlexServerConfig>
): Promise<void> => {
  const { limit, enforce, kill_all, message, exclude_same_ip } = instance.settings;

  // Snapshot BEFORE creating new events, so the close-loop at the end only
  // touches pre-existing ones.
  const openEventsBefore = getOpenEvents(instance.id);
  const violating = new Set<string>();

  for (const user of scope.scopedUsers) {
    const count = user.sessions.length;
    const isViolating = count > limit;

    const isExcluded =
      isViolating && exclude_same_ip ? countsAsSingleLocation(user.sessions, limit) : false;

    if (!isViolating || isExcluded) continue;
    violating.add(user.accountId);

    let openEvent = openEventsBefore.find((e) => e.userId === user.accountId);
    if (!openEvent) {
      logRuleEvent(
        user.accountId,
        instance.id,
        JSON.stringify({
          count,
          limit,
          activeSessions: count,
          source: scope.source,
          instanceName: instance.name,
          details: "",
          enforced: false,
        }),
        scope.eventServerId
      );
      openEvent = getOpenEvents(instance.id).find((e) => e.userId === user.accountId);
    } else if (openEvent.details.enforced === true) {
      // Already enforced, waiting for the sessions to die. Do not re-terminate.
      continue;
    }

    if (enforce) {
      const terminationReason = message || "Stream Limit Exceeded";
      const sessionsToKill = selectSessionsToKill(user.sessions, limit, kill_all);

      let anyTerminated = false;
      for (const s of sessionsToKill) {
        Logger.info(
          `[Enforcement] Rule "${instance.name}" terminating ${s.sessionId || s.sessionKey} for ${user.username}`
        );
        if (await terminateWithNotify(s, serverConfigMap, instance, terminationReason)) {
          anyTerminated = true;
        }
      }

      if (anyTerminated && openEvent) {
        updateRuleEventDetails(
          openEvent.id,
          JSON.stringify({ ...openEvent.details, count, limit, enforced: true })
        );
      }
    }
  }

  // Close events for users that are no longer violating — including users the
  // rule no longer applies to.
  for (const event of openEventsBefore) {
    if (!violating.has(event.userId)) {
      closeRuleEvent(event.id);
    }
  }
};
