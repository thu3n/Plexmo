"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import { useFeedback, errorMessage } from "@/components/ui/Feedback";
import { isMaskedToken } from "@/lib/server-token-mask";
import type { PublicServer } from "@/lib/servers";
import type { DiscoveredConnection } from "../lib/discovered-connections";

const COPIED_FEEDBACK_MS = 2_000;

export type ServerFormValues = { name: string; baseUrl: string; token: string; color: string };
export type TestResult = { success: boolean; message: string };

type TestResponse = { message?: string; latencyMs?: number; version?: string | null };

/**
 * Add/edit form state. The edit form starts with the MASKED token; it is only
 * sent when the user replaced it (or revealed the real one). Otherwise the
 * test route resolves the stored token from `serverId`, and PUT leaves it be.
 */
export function useServerForm(server: PublicServer | null, onSaved: () => void) {
    const { toast } = useFeedback();
    const [values, setValues] = useState<ServerFormValues>({
        name: server?.name ?? "",
        baseUrl: server?.baseUrl ?? "",
        token: server?.maskedToken ?? "",
        color: server?.color ?? "",
    });
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [justCopied, setJustCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
    }, []);

    const setField = (field: keyof ServerFormValues, value: string) => {
        setValues((prev) => ({ ...prev, [field]: value }));
        setTestResult(null);
    };

    const sendableToken = (): string | undefined => (isMaskedToken(values.token) ? undefined : values.token);

    /** Swap the masked placeholder for the real token (owner-only endpoint). */
    const ensureRealToken = async (): Promise<string | null> => {
        const current = sendableToken();
        if (current !== undefined || !server) return current ?? null;
        try {
            const { token } = await fetchJsonOrThrow<{ token: string }>(`/api/servers/${server.id}/token`);
            setValues((prev) => ({ ...prev, token }));
            return token;
        } catch (err) {
            toast(errorMessage(err, "Could not read the saved token"), "error");
            return null;
        }
    };

    const toggleShowToken = async () => {
        if (!showToken && !(await ensureRealToken())) return;
        setShowToken((v) => !v);
    };

    const copyToken = async () => {
        const token = await ensureRealToken();
        if (!token) return;
        try {
            await navigator.clipboard.writeText(token);
            setShowToken(true);
            setJustCopied(true);
            if (copiedTimer.current) clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => setJustCopied(false), COPIED_FEEDBACK_MS);
        } catch {
            toast("Copy failed — your browser blocked clipboard access", "error");
        }
    };

    const applyDiscovered = (conn: DiscoveredConnection) => {
        setValues((prev) => ({ ...prev, name: conn.serverName, baseUrl: conn.uri, token: conn.token }));
        setTestResult(null);
    };

    const testConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const data = await requestJson<TestResponse>("/api/servers/test", {
                method: "POST",
                body: { baseUrl: values.baseUrl, token: sendableToken(), serverId: server?.id },
            });
            const details = [data.version && `Plex ${data.version}`, data.latencyMs != null && `${data.latencyMs} ms`]
                .filter(Boolean)
                .join(" · ");
            const message = data.message || "Connection successful";
            setTestResult({ success: true, message: details ? `${message} (${details})` : message });
        } catch (err) {
            setTestResult({ success: false, message: errorMessage(err, "Connection failed") });
        } finally {
            setIsTesting(false);
        }
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const body = { name: values.name, baseUrl: values.baseUrl, token: sendableToken(), color: values.color };
            if (server) {
                await requestJson(`/api/servers/${server.id}`, { method: "PUT", body });
            } else {
                await requestJson("/api/servers", { method: "POST", body });
            }
            toast(server ? `${values.name || "Server"} saved` : `${values.name || "Server"} added`);
            onSaved();
        } catch (err) {
            toast(errorMessage(err, "Could not save the server"), "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        values,
        setField,
        applyDiscovered,
        testResult,
        isTesting,
        testConnection,
        isSubmitting,
        submit,
        showToken,
        toggleShowToken,
        justCopied,
        copyToken,
    };
}
