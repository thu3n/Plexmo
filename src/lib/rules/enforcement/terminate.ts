import { terminateSession } from "../../plex";
import { sendRuleViolationNotification } from "../../discord";
import { Logger } from "../../logger";
import type { PlexSession, PlexServerConfig } from "../../plex";
import type { PersistedRuleInstance } from "../types";
import { updateRuleEventDetails } from "../rules-assignments";
import type { OpenRuleEvent } from "./context";

/** The rule's own webhook selection; the single-id field predates the multi-select. */
const ruleWebhookIds = (instance: PersistedRuleInstance): string[] =>
  instance.discordWebhookIds?.length
    ? instance.discordWebhookIds
    : instance.discordWebhookId
      ? [instance.discordWebhookId]
      : [];

/** Send the "rule_violation" notification; never throws into enforcement. */
export const notifyRuleViolation = async (
  session: PlexSession,
  instance: PersistedRuleInstance,
  reason: string
): Promise<void> => {
  try {
    await sendRuleViolationNotification(session, instance.name, reason, ruleWebhookIds(instance));
  } catch (err) {
    Logger.error(`[Enforcement] Failed to send rule violation notification for "${instance.name}"`, err);
  }
};

/**
 * Flag-only rules (enforce off) notify once per rule event. The marker lives in
 * the event's details JSON so a restart does not re-announce open events.
 */
export const notifyRuleFlagOnce = async (
  session: PlexSession | undefined,
  instance: PersistedRuleInstance,
  event: OpenRuleEvent | undefined,
  reason: string
): Promise<void> => {
  if (instance.settings.enforce || !session || !event || event.details.flagNotified === true) return;
  event.details = { ...event.details, flagNotified: true };
  updateRuleEventDetails(event.id, JSON.stringify(event.details));
  await notifyRuleViolation(session, instance, reason);
};

/**
 * Terminate one session and fan out the rule's Discord notifications.
 * Returns true only when the Plex terminate call succeeded.
 */
export const terminateWithNotify = async (
  session: PlexSession,
  serverConfigMap: Map<string, PlexServerConfig>,
  instance: PersistedRuleInstance,
  reason: string
): Promise<boolean> => {
  const serverConfig = session.serverId ? serverConfigMap.get(session.serverId) : undefined;
  // Plex's terminate endpoint takes the Session.id (or sessionKey) — never a media key.
  const targetId = session.sessionId || session.sessionKey;

  if (!serverConfig || !targetId) {
    Logger.error(
      `[Enforcement] Cannot terminate session ${session.id}: missing ${serverConfig ? "sessionId/sessionKey" : "server config"}.`
    );
    return false;
  }

  try {
    await terminateSession(targetId, serverConfig, reason);
  } catch (err) {
    Logger.error(`[Enforcement] Failed to terminate session ${targetId}`, err);
    return false;
  }

  await notifyRuleViolation(session, instance, reason);

  return true;
};
