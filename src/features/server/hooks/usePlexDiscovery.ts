"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJsonOrThrow } from "@/lib/swr-fetch";
import {
    rankDiscoveredConnections,
    type DiscoveredConnection,
    type DiscoveredResource,
} from "../lib/discovered-connections";

const POLL_INTERVAL_MS = 2_000;
// plex.tv PINs expire after ~15 min; nobody needs that long to click "Allow".
const SIGN_IN_TIMEOUT_MS = 5 * 60_000;
const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;

export type DiscoveryStatus = "idle" | "authenticating" | "loading" | "ready" | "error";

type PinResponse = { id: number | string; authUrl: string; clientIdentifier: string };

const openCentredPopup = (url: string): Window | null => {
    const left = window.screen.width / 2 - POPUP_WIDTH / 2;
    const top = window.screen.height / 2 - POPUP_HEIGHT / 2;
    return window.open(url, "PlexAuth", `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`);
};

/**
 * "Sign in with Plex" → list the account's servers. Owns the PIN polling
 * loop, and guarantees it stops: on success, popup close, timeout, reset and
 * unmount (closing the modal mid-sign-in used to leave it polling forever).
 */
export function usePlexDiscovery(onReady?: (connections: DiscoveredConnection[]) => void) {
    const [status, setStatus] = useState<DiscoveryStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [connections, setConnections] = useState<DiscoveredConnection[]>([]);
    const [signedIn, setSignedIn] = useState(false);
    const tokenRef = useRef<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const popupRef = useRef<Window | null>(null);
    const mountedRef = useRef(true);
    const onReadyRef = useRef(onReady);

    useEffect(() => {
        onReadyRef.current = onReady;
    });

    const stopPolling = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        pollRef.current = null;
        timeoutRef.current = null;
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            stopPolling();
            popupRef.current?.close();
        };
    }, [stopPolling]);

    const fail = useCallback((message: string) => {
        if (!mountedRef.current) return;
        setError(message);
        setStatus("error");
    }, []);

    const loadResources = useCallback(async () => {
        const token = tokenRef.current;
        if (!token) return;
        setStatus("loading");
        setError(null);
        try {
            const res = await fetch("/api/plex/resources", { headers: { "X-Plex-Token": token }, cache: "no-store" });
            const data = (await res.json().catch(() => null)) as { servers?: DiscoveredResource[]; error?: string } | null;
            if (!res.ok) throw new Error(data?.error || `Could not list your Plex servers (${res.status})`);
            if (!mountedRef.current) return;
            const ranked = rankDiscoveredConnections(data?.servers ?? []);
            setConnections(ranked);
            setStatus("ready");
            onReadyRef.current?.(ranked);
        } catch (err) {
            fail(err instanceof Error ? err.message : "Could not list your Plex servers");
        }
    }, [fail]);

    const pollOnce = useCallback(
        async (pin: PinResponse) => {
            if (popupRef.current?.closed) {
                stopPolling();
                if (mountedRef.current) setStatus("idle");
                return;
            }
            const res = await fetch("/api/auth/plex", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pinId: pin.id, clientIdentifier: pin.clientIdentifier, mode: "discovery" }),
            }).catch(() => null);
            if (!res) return; // transient network error — keep polling
            const data = (await res.json().catch(() => null)) as { token?: string; status?: string; error?: string } | null;
            if (res.ok && data?.token) {
                stopPolling();
                popupRef.current?.close();
                tokenRef.current = data.token;
                if (mountedRef.current) setSignedIn(true);
                await loadResources();
            } else if (data?.status !== "polling") {
                stopPolling();
                popupRef.current?.close();
                fail(data?.error || "Plex sign-in failed");
            }
        },
        [fail, loadResources, stopPolling]
    );

    const signIn = useCallback(async () => {
        stopPolling();
        setError(null);
        setConnections([]);
        setStatus("authenticating");
        try {
            const pin = await fetchJsonOrThrow<PinResponse>("/api/auth/plex");
            const popup = openCentredPopup(pin.authUrl);
            if (!popup) {
                fail("The Plex sign-in window was blocked. Allow pop-ups for this site and try again.");
                return;
            }
            popupRef.current = popup;
            pollRef.current = setInterval(() => void pollOnce(pin), POLL_INTERVAL_MS);
            timeoutRef.current = setTimeout(() => {
                stopPolling();
                popupRef.current?.close();
                fail("Plex sign-in timed out. Try again.");
            }, SIGN_IN_TIMEOUT_MS);
        } catch (err) {
            fail(err instanceof Error ? err.message : "Could not start Plex sign-in");
        }
    }, [fail, pollOnce, stopPolling]);

    const reset = useCallback(() => {
        stopPolling();
        popupRef.current?.close();
        tokenRef.current = null;
        setSignedIn(false);
        setConnections([]);
        setError(null);
        setStatus("idle");
    }, [stopPolling]);

    return {
        status,
        error,
        connections,
        signedIn,
        signIn,
        retryResources: loadResources,
        reset,
    };
}
