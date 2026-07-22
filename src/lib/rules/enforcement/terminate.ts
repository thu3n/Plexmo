import { db } from "../../db";
import { terminateSession } from "../../plex";
import { sendSessionTerminatedNotification } from "../../discord";
import { Logger } from "../../logger";
import type { PlexSession, PlexServerConfig } from "../../plex";
import type { PersistedRuleInstance } from "../types";

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

  const webhookIds = instance.discordWebhookIds?.length
    ? instance.discordWebhookIds
    : instance.discordWebhookId
      ? [instance.discordWebhookId]
      : [];

  for (const wid of webhookIds) {
    try {
      const webhook = db.prepare("SELECT url FROM discord_webhooks WHERE id = ?").get(wid) as
        | { url: string }
        | undefined;
      if (webhook) {
        await sendSessionTerminatedNotification(
          session,
          `Rule "${instance.name}": ${reason}`,
          webhook.url
        );
      }
    } catch (err) {
      Logger.error(`[Enforcement] Failed to send Discord notification for webhook ${wid}`, err);
    }
  }

  return true;
};
