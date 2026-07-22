import { Logger } from "../../logger";
import type { PlexServerConfig } from "../../plex";
import type { PersistedRuleInstance } from "../types";
import { isUserBlockedBySchedule } from "../rules-schedule";
import { logRuleEvent, closeRuleEvent, updateRuleEventDetails } from "../rules-assignments";
import { getOpenEvents, type RuleScope } from "./context";
import { terminateWithNotify } from "./terminate";

export const enforceScheduledAccess = async (
  instance: PersistedRuleInstance,
  scope: RuleScope,
  serverConfigMap: Map<string, PlexServerConfig>
): Promise<void> => {
  const schedule = instance.settings.schedule;
  if (!schedule || !schedule.timeWindows || schedule.timeWindows.length === 0) {
    return;
  }

  const now = new Date();
  const isBlocked = isUserBlockedBySchedule(now, schedule);

  if (!isBlocked) {
    // Window over: every open block event becomes history.
    for (const event of getOpenEvents(instance.id)) {
      closeRuleEvent(event.id);
    }
    return;
  }

  for (const user of scope.scopedUsers) {
    if (user.sessions.length === 0) continue;

    let openEvent = getOpenEvents(instance.id).find((e) => e.userId === user.accountId);
    if (!openEvent) {
      logRuleEvent(
        user.accountId,
        instance.id,
        JSON.stringify({
          blockedTime: now.toISOString(),
          reason: "scheduled_access_block",
          scheduleType: schedule.type,
          source: scope.source,
          instanceName: instance.name,
          activeSessions: user.sessions.length,
          enforced: false,
        }),
        scope.eventServerId
      );
      openEvent = getOpenEvents(instance.id).find((e) => e.userId === user.accountId);
    } else if (openEvent.details.enforced === true) {
      continue;
    }

    if (instance.settings.enforce) {
      const terminationReason =
        instance.settings.message ||
        (schedule.type === "block"
          ? `Access blocked during scheduled hours. Try again later.`
          : `Access only allowed during scheduled hours.`);

      Logger.info(
        `[Scheduled Access] Rule "${instance.name}" blocking ${user.username} (${user.sessions.length} sessions)`
      );

      let anyTerminated = false;
      for (const session of user.sessions) {
        if (await terminateWithNotify(session, serverConfigMap, instance, terminationReason)) {
          anyTerminated = true;
        }
      }

      if (anyTerminated && openEvent) {
        updateRuleEventDetails(
          openEvent.id,
          JSON.stringify({ ...openEvent.details, enforced: true })
        );
      }
    }
  }
};
