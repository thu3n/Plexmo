import type { AllowedUserView } from "@/lib/access";
import type { InviteView } from "@/lib/invites";
import type { PublicServer } from "@/lib/servers";

/** Wire shapes of the Access settings APIs (tokenHash is stripped server-side). */
export type InviteItem = Omit<InviteView, "tokenHash">;
export type AllowedUserItem = AllowedUserView;
export type ServerOption = Pick<PublicServer, "id" | "name" | "archived" | "baseUrl">;

export const INVITES_KEY = "/api/settings/invites";
export const ACCESS_KEY = "/api/settings/access";
export const SERVERS_KEY = "/api/servers";

/** Date + time in the viewer's own locale (not a hardcoded one). */
export const formatDateTime = (iso: string | null): string => {
    if (!iso) return "";
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? iso
        : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

/** "All servers" for an unscoped grant, else the scoped servers' names. */
export const serverScopeLabel = (serverIds: string[] | null, names: Map<string, string>): string =>
    serverIds && serverIds.length > 0
        ? serverIds.map((id) => names.get(id) ?? "Removed server").join(", ")
        : "All servers";

export const personLabel = (person: { username: string | null; email: string | null }): string =>
    person.username && person.email
        ? `${person.username} (${person.email})`
        : person.username || person.email || "Unknown account";
