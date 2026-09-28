/**
 * Canonical RuleInstance type shared between the server-side rules engine
 * (src/lib/rules.ts) and the client-side rules UI. Kept in a dependency-free
 * module so client components can import it without pulling in server-only
 * modules (db, plex). This is the domain shape — `enabled` and `settings` are
 * already decoded from their raw DB storage (0/1 and JSON string).
 */

export interface RuleSchedule {
  type: "block" | "allow";
  timeWindows: Array<{
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
    days: number[]; // 0=Sunday ... 6=Saturday
  }>;
  timezone?: string;
  graceMinutes?: number;
}

export interface RuleSettings {
  limit: number;
  enforce: boolean;
  kill_all: boolean;
  message: string;
  notify?: boolean;
  exclude_same_ip?: boolean;
  schedule?: RuleSchedule;
}

export interface RuleInstance {
  id?: string; // absent while creating a new rule
  type: string;
  name: string;
  enabled: boolean;
  settings: RuleSettings;
  discordWebhookId: string | null; // deprecated, kept for back-compat
  discordWebhookIds?: string[];
  createdAt?: string;
  global?: boolean;
  userNames?: string[];
  serverNames?: string[];
  userCount?: number;
  serverCount?: number;
  assignments?: { userIds: string[]; serverIds: string[] };
}

/** Assignment-picker row from GET /api/rules/instances/[id]/users. */
export interface RuleUserAssignment {
  userId: string;
  username: string;
  email: string | null;
  serverNames: string;
  enabled: boolean;
}

/** Assignment-picker row from GET /api/rules/instances/[id]/servers. */
export interface RuleServerAssignment {
  serverId: string;
  name: string;
  enabled: boolean;
}

/** Row from POST /api/rules/analyze: a user whose limit this draft tightens. */
export interface ImpactedUser {
  username: string;
  oldLimit: number | "Unlimited";
  newLimit: number;
}

/** Row from POST /api/rules/debug: whether one rule applies to the user. */
export interface RuleDebugResult {
  rule: RuleInstance & { id: string };
  applies: boolean;
  reasons: { global: boolean; user: boolean; servers: string[] };
}

/** One enforcement event from GET /api/rules/instances/[id]/events. */
export interface RuleEventEntry {
  id: number;
  userId: string;
  username: string | null;
  serverId: string | null;
  serverName: string | null;
  triggeredAt: string;
  endedAt: string | null;
  /** True once the rule actually terminated streams (vs. only logging). */
  enforced: boolean;
  count: number | null;
  limit: number | null;
  sessionTitle: string | null;
  scheduleType: string | null;
}
