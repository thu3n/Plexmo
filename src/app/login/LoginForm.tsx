"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";

export default function LoginForm() {
    const { t } = useLanguage();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pollingId, setPollingId] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("");
    const popupRef = useRef<Window | null>(null);

    const pollForAuth = useCallback(async (pinId: string) => {
        try {
            const res = await fetch("/api/auth/plex", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pinId }),
            });

            if (res.ok) {
                // Success!
                setStatus(t("login.redirecting") || "Redirecting...");
                if (popupRef.current) popupRef.current.close();
                router.push("/");
                return true; // Stop polling
            } else {
                const data = await res.json();
                if (res.status === 401 && data.status === "polling") {
                    // Still waiting for user
                    return false; // Continue polling
                } else {
                    // Error or Access Denied
                    setError(data.error || t("login.error"));
                    setPollingId(null);
                    return true; // Stop polling
                }
            }
        } catch (e) {
            console.error(e);
            setError(t("login.error"));
            setPollingId(null);
            return true; // Stop polling
        }
    }, [router, t]);

    useEffect(() => {
        if (!pollingId) return;

        setStatus(t("login.authenticating") || "Waiting for Plex...");

        // Poll every 2 seconds
        const interval = setInterval(async () => {
            const stop = await pollForAuth(pollingId);
            if (stop) {
                clearInterval(interval);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [pollingId, pollForAuth, t]);

    const handleLogin = async () => {
        setIsLoading(true);
        setError(null);

        // 1. Open Popup Immediately (to avoid Safari blocker)
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
            "",
            "PlexAuth",
            `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
        );
        popupRef.current = popup;

        if (popup) {
            popup.document.body.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;background:#1a1a1a;color:white;"><h3>${t("login.authenticating")}...</h3></div>`;
        }

        try {
            // 2. Get PIN
            const res = await fetch("/api/auth/plex");
            if (!res.ok) throw new Error("Failed to initialize login");
            const data = await res.json();

            // 3. Redirect Popup
            if (popup) {
                popup.location.href = data.authUrl;
            } else {
                throw new Error(t("login.popupBlocked") || "Popup blocked");
            }

            // 4. Start Polling
            setPollingId(data.id);
        } catch (e: any) {
            setError(e.message || t("login.error"));
            setIsLoading(false);
            if (popup) popup.close();
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white font-sans overflow-hidden relative">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-sm space-y-8 rounded-2xl border border-white/5 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
                <div className="text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center mb-6">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/images/Plexmo_icon.png"
                            alt="Plexmo"
                            className="h-full w-full object-contain rounded-2xl shadow-lg shadow-amber-500/20"
                        />
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{t("login.title") || "Sign in"}</h2>
                    <p className="mt-2 text-sm text-white/50">
                        {t("common.appName") || "Plexmo"}
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-200 text-center">
                        {error}
                    </div>
                )}

                <div className="mt-8 space-y-4">
                    <button
                        onClick={handleLogin}
                        disabled={isLoading && !!pollingId}
                        className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-[#e5a00d] px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#d4940c] hover:shadow-lg hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {!pollingId ? (
                            <>

                                {t("login.signInWithPlex") || "Sign in with Plex"}
                            </>
                        ) : (
                            <>
                                <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {status}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
