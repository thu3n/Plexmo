"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { isStandaloneDisplayMode } from "@/lib/standalone";

const POLL_INTERVAL_MS = 2000;

/**
 * Plex PIN OAuth for the setup/invite wizard. Two flows:
 * - Popup (browser tabs/desktop): opens the popup synchronously (Safari
 *   blocker), navigates it to app.plex.tv, polls until claimed.
 * - Device code (installed PWA): a popup navigation to app.plex.tv is
 *   out-of-scope and kicks iOS out of standalone mode, so standalone contexts
 *   get a plex.tv/link code (`linkCode`) instead and only poll.
 * `inviteToken` (when present) rides along in the poll body so the server can
 * redeem a one-time invite for accounts that are neither owners nor whitelisted.
 */
export function usePlexPin({
    inviteToken,
    onSuccess,
}: {
    inviteToken?: string;
    onSuccess: () => void | Promise<void>;
}) {
    const { t } = useLanguage();
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [linkCode, setLinkCode] = useState<string | null>(null);

    const startPolling = (pinId: string, clientIdentifier: string, popup: Window | null) => {
        const pollInterval = setInterval(async () => {
            if (popup && popup.closed) {
                clearInterval(pollInterval);
                setIsAuthenticating(false);
                return;
            }
            try {
                const checkRes = await fetch("/api/auth/plex", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pinId, clientIdentifier, inviteToken }),
                });
                if (checkRes.ok) {
                    clearInterval(pollInterval);
                    popup?.close();
                    setLinkCode(null);
                    await onSuccess();
                    setIsAuthenticating(false);
                } else if (checkRes.status === 403 || checkRes.status === 429) {
                    clearInterval(pollInterval);
                    popup?.close();
                    const errData = await checkRes.json().catch(() => null);
                    setLoginError(errData?.error || t("login.accessDenied"));
                    setLinkCode(null);
                    setIsAuthenticating(false);
                }
                // 401 = PIN not claimed yet — keep polling.
            } catch {
                // Ignore transient polling errors.
            }
        }, POLL_INTERVAL_MS);
    };

    const login = async () => {
        setIsAuthenticating(true);
        setLoginError("");

        // Installed PWA: never navigate out of scope — device-code flow.
        if (isStandaloneDisplayMode()) {
            try {
                const res = await fetch("/api/auth/plex?flow=link");
                if (!res.ok) throw new Error(t("login.error"));
                const { id, code, clientIdentifier } = await res.json();
                setLinkCode(code);
                startPolling(id, clientIdentifier, null);
            } catch (err) {
                setLoginError(err instanceof Error ? err.message : t("login.error"));
                setIsAuthenticating(false);
            }
            return;
        }

        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open("", "PlexAuth", `width=${width},height=${height},left=${left},top=${top}`);
        if (popup) {
            popup.document.body.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;color:#333;"><h3>${t("login.authenticating")}...</h3></div>`;
        }

        try {
            const res = await fetch("/api/auth/plex");
            if (!res.ok) throw new Error("Failed to start authentication");
            const { id, authUrl, clientIdentifier } = await res.json();

            if (popup) {
                popup.location.href = authUrl;
            } else {
                throw new Error(t("login.popupBlocked"));
            }

            startPolling(id, clientIdentifier, popup);
        } catch (err) {
            console.error(err);
            setLoginError(err instanceof Error ? err.message : t("login.error"));
            setIsAuthenticating(false);
        }
    };

    return { login, isAuthenticating, loginError, linkCode };
}
