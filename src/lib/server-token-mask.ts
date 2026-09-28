/**
 * Client-safe helpers for the masked token shown in Settings. The UI only ever
 * receives `maskToken(token)`; anything containing the mask character is a
 * placeholder, never a credential, and must not be sent to Plex or stored.
 */
export const TOKEN_MASK_CHAR = "…";

const VISIBLE_PREFIX = 4;
const VISIBLE_SUFFIX = 2;

export const maskToken = (token: string): string =>
    `${token.slice(0, VISIBLE_PREFIX)}${TOKEN_MASK_CHAR}${token.slice(-VISIBLE_SUFFIX)}`;

export const isMaskedToken = (value: unknown): boolean =>
    typeof value === "string" && value.includes(TOKEN_MASK_CHAR);
