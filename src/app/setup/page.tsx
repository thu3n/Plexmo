"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import useSWR from "swr";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { type PlexResource, flattenResources } from "@/lib/plex-utils";
import LoginStep from "@/features/setup/components/LoginStep";
import ServerConfigStep from "@/features/setup/components/ServerConfigStep";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OnboardingPage() {
    const { t } = useLanguage();
    const router = useRouter();

    // -- AUTH STATE --
    const { data: userData, mutate: mutateUser, error: userError } = useSWR("/api/auth/me", fetcher);
    // Explicitly check for user object presence. SWR might return empty object or error.
    const isAuthenticated = userData && userData.user;

    // Derived step: If not auth -> 1, If auth -> 2
    const currentStep = isAuthenticated ? 2 : 1;

    // -- LOGIN STATE --
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [loginError, setLoginError] = useState("");

    // -- CONFIG STATE --
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


    // --- LOGIN HANDLER ---
    const handleLogin = async () => {
        setIsAuthenticating(true);
        setLoginError("");

        // 1. Open Popup Immediately (to avoid Safari blocker)
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
            "",
            "PlexAuth",
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (popup) {
            popup.document.body.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;color:#333;"><h3>${t("login.authenticating")}...</h3></div>`;
        }

        try {
            // 2. Get PIN
            const res = await fetch("/api/auth/plex");
            if (!res.ok) throw new Error("Failed to start authentication");

            const { code, id, authUrl, clientIdentifier } = await res.json();

            // 3. Redirect Popup
            if (popup) {
                popup.location.href = authUrl;
            } else {
                throw new Error(t("login.popupBlocked"));
            }

            // 3. Poll for Success
            const pollInterval = setInterval(async () => {
                if (popup?.closed) {
                    clearInterval(pollInterval);
                    setIsAuthenticating(false);
                    return;
                }

                try {
                    const checkRes = await fetch("/api/auth/plex", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pinId: id, clientIdentifier }),
                    });

                    if (checkRes.ok) {
                        clearInterval(pollInterval);
                        popup?.close();
                        // Success! Re-fetch user to update state and move to step 2
                        await mutateUser();
                        // Small delay to allow SWR to update before we rely on isAuthenticated logic if needed
                    } else if (checkRes.status === 403) {
                        // Owned check failed
                        clearInterval(pollInterval);
                        popup?.close();
                        const errData = await checkRes.json();
                        setLoginError(errData.error || t("login.accessDenied"));
                        setIsAuthenticating(false);
                    }
                } catch (e) {
                    // Ignore polling errors
                }
            }, 2000);

        } catch (err: any) {
            console.error(err);
            setLoginError(t("login.error"));
            setIsAuthenticating(false);
        }
    };


    // --- CONFIG HANDLERS ---
    const fetchServers = async () => {
        setIsLoadingServers(true);
        setConfigError(null);
        try {
            const res = await fetch("/api/plex/resources");

            if (res.status === 401) {
                // If unauthorized, re-check session
                await mutateUser();
                return;
            }

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Error ${res.status}: ${text}`);
            }

            const data = await res.json();
            setServers(data.servers || []);
        } catch (err: any) {
            console.error(err);
            setConfigError(err.message || "Could not load servers. Please try again.");
        } finally {
            setIsLoadingServers(false);
        }
    };

    const flatConnections = flattenResources(servers);

    const handleSelectConnection = (connectionId: string) => {
        const conn = flatConnections.find((c) => c.id === connectionId);
        if (!conn) return;

        setSelectedServerIdentifier(conn.id); // Use the connection ID now
        const uri = conn.uri;
        setToken(conn.token);

        try {
            const url = new URL(uri);
            setHostname(`${url.protocol}//${url.hostname}`);
            setPort(url.port || (url.protocol === "https:" ? "443" : "80"));
            setUseSsl(url.protocol === "https:");
        } catch (e) {
            // Fallback if parsing fails (unlikely from API)
            setHostname(uri);
        }
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        setConfigError(null);

        let baseUrl = hostname.replace(/\/$/, "");
        if (port && !baseUrl.includes(`:${port}`)) {
            baseUrl = `${baseUrl}:${port}`;
        }

        try {
            const res = await fetch("/api/servers/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseUrl,
                    token,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Testet misslyckades");

            setTestResult({ success: true, message: data.message || "Anslutning lyckades!" });
        } catch (err) {
            setTestResult({ success: false, message: err instanceof Error ? err.message : "Testet misslyckades" });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setConfigError(null);

        let baseUrl = hostname.replace(/\/$/, "");
        if (port && !baseUrl.includes(`:${port}`)) {
            baseUrl = `${baseUrl}:${port}`;
        }

        try {
            const res = await fetch("/api/servers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: servers.find(s => s.clientIdentifier === selectedServerIdentifier)?.name || "Plex Server",
                    baseUrl: baseUrl,
                    token: token,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save server.");
            }

            // Trigger initial sync
            try {
                await fetch("/api/jobs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: 'sync_all_library_lists' }),
                });
            } catch (e) {
                console.error("Failed to trigger initial sync", e);
            }

            router.push("/");
        } catch (err: any) {
            setConfigError(err.message || "Failed to connect server");
            setIsSaving(false);
        }
    };

    // -- VARIANTS FOR ANIMATION --
    const containerVariants: Variants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: {
            opacity: 1,
            scale: 1,
            transition: { duration: 0.5, ease: "easeOut" as const }
        },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
    };

    const floatingGradientVariants: Variants = {
        animate: {
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.3, 0.5, 0.3],
            transition: {
                duration: 15,
                repeat: Infinity,
                ease: "linear" as const
            }
        }
    };

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 font-sans selection:bg-amber-500/30">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-premium-gradient opacity-40 mix-blend-soft-light" />
                <motion.div
                    variants={floatingGradientVariants}
                    animate="animate"
                    className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-blue-600/10 blur-[120px]"
                />
                <motion.div
                    variants={floatingGradientVariants}
                    animate="animate"
                    transition={{ delay: 2, duration: 18, repeat: Infinity }}
                    className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-amber-600/10 blur-[100px]"
                />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-8 text-center"
                >
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/images/Plexmo_icon.png"
                            alt="Plexmo"
                            className="h-full w-full object-contain rounded-2xl shadow-lg shadow-amber-500/20"
                        />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2 drop-shadow-sm">
                        {t("onboarding.title")}
                    </h1>
                    <p className="text-lg text-slate-400 max-w-md mx-auto leading-relaxed">
                        {t("onboarding.subtitle")}
                    </p>
                </motion.div>

                <OnboardingSteps currentStep={currentStep} />

                <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                        <LoginStep
                            containerVariants={containerVariants}
                            isAuthenticating={isAuthenticating}
                            loginError={loginError}
                            onLogin={handleLogin}
                            t={t}
                        />
                    )}

                    {currentStep === 2 && (
                        <ServerConfigStep
                            containerVariants={containerVariants}
                            servers={servers}
                            flatConnections={flatConnections}
                            selectedServerIdentifier={selectedServerIdentifier}
                            hostname={hostname}
                            port={port}
                            useSsl={useSsl}
                            isLoadingServers={isLoadingServers}
                            isTesting={isTesting}
                            isSaving={isSaving}
                            testResult={testResult}
                            configError={configError}
                            onSelectConnection={handleSelectConnection}
                            onFetchServers={fetchServers}
                            setHostname={setHostname}
                            setPort={setPort}
                            setUseSsl={setUseSsl}
                            onTestConnection={handleTestConnection}
                            onSave={handleSave}
                            t={t}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
