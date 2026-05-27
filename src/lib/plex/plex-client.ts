import { XMLParser } from "fast-xml-parser";
import type { PlexServerConfig } from "./plex-types";

// Shared XML parser + low-level HTTP helpers. `parser` and `toArray` were
// module-private in the original plex.ts; they are exported here so the sibling
// session/library/user modules can reuse them, but they are intentionally NOT
// re-exported from the plex/ barrel (they were never part of the public API).

export const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  processEntities: true,
  parseTagValue: true, // Needed to ensure values are processed
});

export const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export const resolveServer = (server?: PlexServerConfig): PlexServerConfig => {
  if (server?.baseUrl && server?.token) {
    return { ...server, baseUrl: server.baseUrl.replace(/\/$/, "") };
  }

  const baseUrl = process.env.PLEX_BASE_URL;
  const token = process.env.PLEX_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Ingen Plex-server är konfigurerad. Lägg till en server i inställningar.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    token,
    name: "Standard Plex",
  };
};

export const normalizePlexUrl = (url: string): string => {
  let normalized = url.trim();

  // 1. Ensure Scheme
  if (!normalized.match(/^https?:\/\//)) {
    normalized = `http://${normalized}`;
  }

  // 2. Fix missing colon before port 32400 (common copy-paste error)
  // Logic: Ends with 32400, but NOT :32400
  // e.g. "play.geek.nu32400" -> "play.geek.nu:32400"
  if (normalized.endsWith("32400") && !normalized.endsWith(":32400")) {
    normalized = normalized.replace(/32400$/, ":32400");
  }

  return normalized.replace(/\/$/, ""); // Ensure no trailing slash
};

export const plexFetch = async (
  path: string,
  params: Record<string, string | number> = {},
  server?: PlexServerConfig,
) => {
  const { baseUrl, token } = resolveServer(server);
  const url = new URL(`${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`);

  url.searchParams.set("X-Plex-Token", token);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 3 seconds timeout

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Plex request failed: ${response.status} ${response.statusText} - ${message}`);
    }

    return parser.parse(await response.text());
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Kunde inte ansluta till Plex på '${baseUrl}'. Tidsgränsen överskreds (3s). Kontrollera om servern är igång.`);
    }
    if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      const port = url.port || (url.protocol === 'https:' ? '443' : '80');
      if (port === '80' || port === '443') {
        throw new Error(`Kunde inte ansluta till Plex på '${baseUrl}'. Anslutning nekades på port ${port}. Glömde du att ange porten (t.ex. :32400)?`);
      }
      throw new Error(`Kunde inte ansluta till Plex på '${baseUrl}'. Kontrollera att servern är igång och nåbar.`);
    }
    throw error;
  }
};

export const decodePlexString = (str?: string): string => {
  if (!str) return "";

  // Basic entities
  let decoded = str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Swedish Characters
    .replace(/&aring;/g, "å")
    .replace(/&Aring;/g, "Å")
    .replace(/&auml;/g, "ä")
    .replace(/&Auml;/g, "Ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&Ouml;/g, "Ö")
    // Numeric Entities (Decimal)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    // Numeric Entities (Hex)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Sometimes double encoding happens (e.g. &amp;#228;)
  if (decoded.includes("&#")) {
    decoded = decoded
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  return decoded;
};
