"use client";

import { useState } from "react";
import { type PlexResource, flattenResources } from "@/lib/plex-utils";

/**
 * Server-connection state for the setup/invite wizard: plex.tv discovery,
 * host/port/SSL fields, the manual (Advanced) name+token entry, connection
 * test and save. UI components consume the returned object whole.
 */
export function useServerSetup({
    onSaved,
    onUnauthorized,
}: {
    onSaved: () => void;
    onUnauthorized: () => void | Promise<void>;
}) {
    const [servers, setServers] = useState<PlexResource[]>([]);
    const [isLoadingServers, setIsLoadingServers] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [configError, setConfigError] = useState<string | null>(null);

    const [selectedServerIdentifier, setSelectedServerIdentifier] = useState("");
    const [hostname, setHostname] = useState("http://");
    const [port, setPort] = useState("32400");
    const [useSsl, setUseSsl] = useState(false);
    const [token, setToken] = useState("");
    const [manualName, setManualName] = useState("");

    const flatConnections = flattenResources(servers);

    const fetchServers = async () => {
        setIsLoadingServers(true);
        setConfigError(null);
        try {
            const res = await fetch("/api/plex/resources");
            if (res.status === 401) {
                await onUnauthorized();
                return;
            }
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Error ${res.status}: ${text}`);
            }
            const data = await res.json();
            setServers(data.servers || []);
        } catch (err) {
            console.error(err);
            setConfigError(err instanceof Error ? err.message : "Could not load servers. Please try again.");
        } finally {
            setIsLoadingServers(false);
        }
    };

    const selectConnection = (connectionId: string) => {
        const conn = flatConnections.find((c) => c.id === connectionId);
        if (!conn) return;
        setSelectedServerIdentifier(conn.id);
        setToken(conn.token);
        try {
            const url = new URL(conn.uri);
            setHostname(`${url.protocol}//${url.hostname}`);
            setPort(url.port || (url.protocol === "https:" ? "443" : "80"));
            setUseSsl(url.protocol === "https:");
        } catch {
            setHostname(conn.uri);
        }
    };

    const buildBaseUrl = () => {
        let baseUrl = hostname.replace(/\/$/, "");
        if (port && !baseUrl.includes(`:${port}`)) {
            baseUrl = `${baseUrl}:${port}`;
        }
        return baseUrl;
    };

    const testConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        setConfigError(null);
        try {
            const res = await fetch("/api/servers/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ baseUrl: buildBaseUrl(), token }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Connection test failed");
            setTestResult({ success: true, message: data.message || "Connected!" });
        } catch (err) {
            setTestResult({
                success: false,
                message: err instanceof Error ? err.message : "Connection test failed",
            });
        } finally {
            setIsTesting(false);
        }
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setConfigError(null);
        try {
            const discoveredName = flatConnections.find((c) => c.id === selectedServerIdentifier)?.name;
            const res = await fetch("/api/servers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: manualName.trim() || discoveredName || "Plex Server",
                    baseUrl: buildBaseUrl(),
                    token,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save server.");
            }
            onSaved();
        } catch (err) {
            setConfigError(err instanceof Error ? err.message : "Failed to connect server");
            setIsSaving(false);
        }
    };

    return {
        servers,
        flatConnections,
        isLoadingServers,
        isSaving,
        isTesting,
        testResult,
        configError,
        selectedServerIdentifier,
        hostname,
        port,
        useSsl,
        token,
        manualName,
        setHostname,
        setPort,
        setUseSsl,
        setToken,
        setManualName,
        fetchServers,
        selectConnection,
        testConnection,
        save,
    };
}

export type ServerSetup = ReturnType<typeof useServerSetup>;
