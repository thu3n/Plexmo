import { describe, it, expect } from "vitest";
import { parseOutboundUrl, isAllowedOutboundUrl } from "@/lib/outbound-url";
import { resolveTautulliApiBase, tautulliApiUrl } from "@/lib/tautulli-url";

describe("parseOutboundUrl", () => {
    it("allows ordinary http(s) targets", () => {
        expect(parseOutboundUrl("https://discord.com/api/webhooks/1/abc")?.hostname).toBe("discord.com");
        expect(parseOutboundUrl("http://192.168.1.50:8181")?.port).toBe("8181");
    });

    it("allows LAN targets — Tautulli and self-run relays live there", () => {
        expect(isAllowedOutboundUrl("http://192.168.1.50:8181")).toBe(true);
        expect(isAllowedOutboundUrl("http://10.0.0.5:8181")).toBe(true);
        expect(isAllowedOutboundUrl("http://127.0.0.1:8181")).toBe(true);
    });

    it("rejects cloud instance-metadata endpoints", () => {
        expect(isAllowedOutboundUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
        expect(isAllowedOutboundUrl("http://metadata.google.internal/computeMetadata/v1/")).toBe(false);
        expect(isAllowedOutboundUrl("http://0.0.0.0:8080/")).toBe(false);
    });

    it("rejects non-http schemes", () => {
        expect(isAllowedOutboundUrl("file:///etc/passwd")).toBe(false);
        expect(isAllowedOutboundUrl("gopher://host:70/")).toBe(false);
        expect(isAllowedOutboundUrl("ftp://host/x")).toBe(false);
    });

    it("rejects embedded credentials, which hide the real host", () => {
        expect(isAllowedOutboundUrl("http://user:pass@evil.example/")).toBe(false);
        expect(isAllowedOutboundUrl("http://discord.com@evil.example/")).toBe(false);
    });

    it("rejects garbage and non-strings", () => {
        expect(isAllowedOutboundUrl("not a url")).toBe(false);
        expect(isAllowedOutboundUrl("")).toBe(false);
        expect(isAllowedOutboundUrl(null)).toBe(false);
        expect(isAllowedOutboundUrl(undefined)).toBe(false);
        expect(isAllowedOutboundUrl({ href: "http://x/" })).toBe(false);
    });
});

describe("resolveTautulliApiBase", () => {
    it("appends /api/v2 to a plain base URL", () => {
        expect(resolveTautulliApiBase("http://192.168.1.50:8181")).toBe("http://192.168.1.50:8181/api/v2");
    });

    it("tolerates trailing slashes", () => {
        expect(resolveTautulliApiBase("http://tautulli.local:8181///")).toBe("http://tautulli.local:8181/api/v2");
    });

    it("keeps a base path (reverse-proxy subpath deployments)", () => {
        expect(resolveTautulliApiBase("http://host/tautulli")).toBe("http://host/tautulli/api/v2");
    });

    it("does not let a fragment truncate the appended path", () => {
        // The original concatenation produced
        // http://169.254.169.254/latest/meta-data/#/api/v2, and fetch dropped
        // the fragment — pointing the request at the metadata endpoint.
        expect(resolveTautulliApiBase("http://169.254.169.254/latest/meta-data/#")).toBeNull();
        expect(resolveTautulliApiBase("http://host/anything#")).toBe("http://host/anything/api/v2");
    });

    it("drops a query on the base rather than letting it swallow the path", () => {
        expect(resolveTautulliApiBase("http://host/?x=1")).toBe("http://host/api/v2");
    });

    it("rejects what parseOutboundUrl rejects", () => {
        expect(resolveTautulliApiBase("http://169.254.169.254/")).toBeNull();
        expect(resolveTautulliApiBase("file:///tmp/x")).toBeNull();
    });
});

describe("tautulliApiUrl", () => {
    it("encodes the api key instead of letting it inject parameters", () => {
        const url = tautulliApiUrl("http://host/api/v2", "k&cmd=delete_history", { cmd: "get_history" });
        expect(new URL(url).searchParams.get("apikey")).toBe("k&cmd=delete_history");
        expect(new URL(url).searchParams.get("cmd")).toBe("get_history");
    });

    it("encodes parameter values", () => {
        const url = tautulliApiUrl("http://host/api/v2", "k", { cmd: "get_history", server_id: "1&length=99999" });
        expect(new URL(url).searchParams.get("server_id")).toBe("1&length=99999");
        expect(new URL(url).searchParams.get("length")).toBeNull();
    });
});
