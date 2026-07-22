import { Logger } from "../../logger";
import type { PlexServerConfig, PlexSession } from "../../plex";
import type { PersistedRuleInstance } from "../types";
import {
  logRuleEvent,
  closeRuleEvent,
  deleteRuleEvent,
  updateRuleEventDetails,
} from "../rules-assignments";
import {
  getActiveStreamRow,
  getOpenEvents,
  type OpenRuleEvent,
  type RuleScope,
} from "./context";
import { terminateWithNotify } from "./terminate";

/**
 * Match an open event to a live session. New events store
 * {serverId, sessionKey}; legacy events stored the media ratingKey under
 * `sessionId` (pre-v2, when the session id WAS the ratingKey).
 */
const eventMatchesSession = (details: Record<string, unknown>, session: PlexSession): boolean => {
  if (details.sessionKey) {
    return (
      session.serverId === details.serverId && session.sessionKey === String(details.sessionKey)
    );
  }
  if (details.sessionId) {
    return session.ratingKey === String(details.sessionId);
  }
  return false;
};

const findOpenEventForSession = (
  events: OpenRuleEvent[],
  accountId: string,
  session: PlexSession
): OpenRuleEvent | undefined =>
  events.find((e) => e.userId === accountId && eventMatchesSession(e.details, session));

export const enforcePausedStreams = async (
  instance: PersistedRuleInstance,
  scope: RuleScope,
  serverConfigMap: Map<string, PlexServerConfig>
): Promise<void> => {
  const { limit, enforce, message } = instance.settings;
  const sessionsByAccount = new Map(scope.scopedUsers.map((u) => [u.accountId, u.sessions]));

  // --- Cleanup: reconcile every open event against the live session list ---
  for (const event of getOpenEvents(instance.id)) {
    const d = event.details;
    if (!d.sessionKey && !d.sessionId) {
      deleteRuleEvent(event.id);
      continue;
    }

    const userSessions = sessionsByAccount.get(event.userId) ?? [];
    const currentSession = userSessions.find((s) => eventMatchesSession(d, s));

    if (d.enforced === true) {
      // Enforced: the event closes (becomes history) once the session dies.
      if (!currentSession) closeRuleEvent(event.id);
      continue;
    }

    if (!currentSession) {
      // Paused briefly, then stopped on their own — not a violation to keep.
      deleteRuleEvent(event.id);
      continue;
    }

    const row = getActiveStreamRow(currentSession);
    if (!row?.pausedSince) {
      // DB says not paused. If the LIVE session still says paused the sync is
      // lagging — trust the live state and keep the event for the next pass.
      if (currentSession.state === "paused") continue;
      deleteRuleEvent(event.id);
    }
  }

  // --- Detection & enforcement ---
  for (const user of scope.scopedUsers) {
    for (const session of user.sessions) {
      const row = getActiveStreamRow(session);
      if (!row?.pausedSince) continue;

      const pausedDurationMinutes = (Date.now() - row.pausedSince) / 1000 / 60;
      const isEnforceable = pausedDurationMinutes >= limit;

      const violationDetails = {
        serverId: session.serverId,
        sessionKey: session.sessionKey,
        pausedDuration: Math.round(pausedDurationMinutes),
        limit,
        sessionTitle: session.title,
        source: scope.source,
        instanceName: instance.name,
        enforced: false,
      };

      let openEvent = findOpenEventForSession(getOpenEvents(instance.id), user.accountId, session);
      if (!openEvent) {
        logRuleEvent(
          user.accountId,
          instance.id,
          JSON.stringify(violationDetails),
          scope.eventServerId
        );
        openEvent = findOpenEventForSession(getOpenEvents(instance.id), user.accountId, session);
      } else if (openEvent.details.enforced === true) {
        continue;
      }

      if (enforce && isEnforceable) {
        const substituteVariables = (template: string, minutes: number): string =>
          template.replace(/\$time/g, `${minutes} minuter`);

        const terminationReason = message
          ? substituteVariables(message, limit)
          : `Stream paused for >${limit} minutes.`;

        Logger.info(
          `[Enforcement] Rule "${instance.name}" terminating paused session ${session.sessionId || session.sessionKey} for ${user.username}`
        );

        if (await terminateWithNotify(session, serverConfigMap, instance, terminationReason)) {
          if (openEvent) {
            updateRuleEventDetails(
              openEvent.id,
              JSON.stringify({ ...violationDetails, enforced: true })
            );
          }
        }
      }
    }
  }
};
