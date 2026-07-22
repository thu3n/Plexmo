import { Logger } from "../../logger";
import type { PlexSession, PlexServerConfig } from "../../plex";
import { getRuleInstances } from "../rules-crud";
import { loadServerConfigs, resolveRuleScope } from "./context";
import { enforceConcurrentStreams } from "./concurrent";
import { enforcePausedStreams } from "./paused";
import { enforceScheduledAccess } from "./scheduled";

/**
 * Single enforcement entry point, called only from the cron pipeline (which
 * serializes runs). `sessions` is the combined multi-server list; per-rule
 * server scoping happens in resolveRuleScope BEFORE any counting.
 */
export const checkAndLogViolations = async (sessions: PlexSession[]) => {
  try {
    const instances = getRuleInstances();

    const needsConfigs = instances.some((i) => i.enabled && i.settings.enforce);
    const serverConfigMap: Map<string, PlexServerConfig> = needsConfigs
      ? await loadServerConfigs()
      : new Map();

    for (const instance of instances) {
      if (!instance.enabled) continue;

      const scope = resolveRuleScope(instance, sessions);

      switch (instance.type) {
        case "kill_paused_streams":
          await enforcePausedStreams(instance, scope, serverConfigMap);
          break;
        case "scheduled_access":
          await enforceScheduledAccess(instance, scope, serverConfigMap);
          break;
        case "max_concurrent_streams":
          await enforceConcurrentStreams(instance, scope, serverConfigMap);
          break;
      }
    }
  } catch (e) {
    Logger.error("Error checking rule violations:", e);
  }
};
