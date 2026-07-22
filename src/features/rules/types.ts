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
