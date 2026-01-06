"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

import { type PlexResource, flattenResources } from "@/lib/plex-utils";

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
    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: {
            opacity: 1,
            scale: 1,
            transition: { duration: 0.5, ease: "easeOut" as const }
        },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
    };

    const floatingGradientVariants = {
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
                        <motion.div
                            key="step1"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full max-w-md"
                        >
                            <div className="glass-panel overflow-hidden rounded-2xl p-8 backdrop-blur-xl">
                                <h2 className="text-2xl font-semibold text-white mb-2 text-center">{t("login.title")}</h2>
                                <p className="text-slate-400 mb-8 text-center">
                                    {t("login.subtitle") || "Sign in with your Plex account to get started."}
                                </p>

                                {loginError && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 text-center text-sm text-rose-300"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                            </svg>
                                            {loginError}
                                        </div>
                                    </motion.div>
                                )}

                                <button
                                    onClick={handleLogin}
                                    disabled={isAuthenticating}
                                    className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 font-bold text-white shadow-lg shadow-amber-900/20 transition-all hover:scale-[1.02] hover:shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                                >
                                    <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                                    <span className="relative flex items-center justify-center gap-3 text-lg">
                                        {isAuthenticating ? (
                                            <>
                                                <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                {t("login.authenticating")}...
                                            </>
                                        ) : (
                                            <>
                                                {t("login.signInWithPlex")}

                                            </>
                                        )}
                                    </span>
                                </button>

                                <div className="mt-6 text-center">
                                    <p className="text-xs text-slate-500">
                                        Secure authentication via Plex.tv
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full max-w-2xl"
                        >
                            <div className="glass-panel overflow-hidden rounded-2xl p-8 backdrop-blur-xl">

                                {/* Info Box */}
                                <div className="mb-8 flex gap-4 rounded-xl bg-indigo-500/10 p-5 border border-indigo-500/20">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-medium text-indigo-200">Configuration Required</h3>
                                        <p className="text-sm text-indigo-200/70 leading-relaxed">
                                            {t("onboarding.form.serverPlaceholder")}
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleSave} className="space-y-8">

                                    {/* Server Selection */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-white/80">{t("session.server")}</label>
                                        <div className="flex gap-3">
                                            <div className="relative flex-1 group">
                                                <select
                                                    value={selectedServerIdentifier}
                                                    onChange={(e) => handleSelectConnection(e.target.value)}
                                                    disabled={servers.length === 0}
                                                    className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/40 px-5 py-4 text-white placeholder-white/30 transition-all focus:border-amber-500 focus:bg-slate-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 hover:border-white/20 cursor-pointer"
                                                >
                                                    <option value="">{t("onboarding.form.selectServer")}</option>
                                                    {flatConnections.map(conn => (
                                                        <option key={conn.id} value={conn.id}>
                                                            {conn.name} ({conn.uri}) - {conn.isLocal ? "Local" : "Remote"}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/50 group-hover:text-amber-500 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={fetchServers}
                                                disabled={isLoadingServers}
                                                className="flex items-center justify-center rounded-xl bg-white/5 border border-white/10 px-5 py-2 text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-50 transition-all active:scale-95"
                                                title={t("onboarding.form.loadServers")}
                                            >
                                                {isLoadingServers ? (
                                                    <svg className="h-5 w-5 animate-spin text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white/80">
                                                        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.43l-.31-.31a7 7 0 00-11.712 3.138.75.75 0 001.449.39 5.5 5.5 0 019.201-2.466l.312.311h-2.433a.75.75 0 000 1.5h4.242z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Manual Connection Details */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-2 space-y-3">
                                            <label className="text-sm font-medium text-white/80">{t("onboarding.form.hostname")} <span className="text-amber-500">*</span></label>
                                            <input
                                                type="text"
                                                value={hostname}
                                                onChange={(e) => setHostname(e.target.value)}
                                                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-5 py-4 text-white placeholder-white/30 transition-all focus:border-amber-500 focus:bg-slate-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-white/20"
                                                placeholder="http://127.0.0.1"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-white/80">{t("onboarding.form.port")} <span className="text-amber-500">*</span></label>
                                            <input
                                                type="text"
                                                value={port}
                                                onChange={(e) => setPort(e.target.value)}
                                                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-5 py-4 text-white placeholder-white/30 transition-all focus:border-amber-500 focus:bg-slate-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-white/20"
                                                placeholder="32400"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* SSL Toggle */}
                                    <div className="flex items-center justify-between rounded-xl bg-white/5 p-4 border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-white">{t("onboarding.form.useSsl")}</span>
                                                <span className="text-xs text-white/40">Enable if your server uses HTTPS</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setUseSsl(!useSsl)}
                                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 ${useSsl ? 'bg-amber-500' : 'bg-slate-700'}`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useSsl ? 'translate-x-5' : 'translate-x-0'}`}
                                            />
                                        </button>
                                    </div>

                                    {/* Actions */}
                                    <div className="space-y-4 pt-4">
                                        {/* Verify Button */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={handleTestConnection}
                                                disabled={isTesting || !hostname}
                                                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-4 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/20 disabled:opacity-50"
                                            >
                                                {isTesting ? "Testing..." : (t("onboarding.form.verify") || "Verify Connection")}
                                            </button>

                                            <AnimatePresence>
                                                {testResult && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        className={`mt-3 flex items-center gap-3 rounded-lg p-3 text-sm border ${testResult.success ? "bg-green-500/10 text-green-300 border-green-500/20" : "bg-rose-500/10 text-rose-300 border-rose-500/20"}`}
                                                    >
                                                        {testResult.success ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                                            </svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                        {testResult.message}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Save Button */}
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 font-bold text-white shadow-xl shadow-amber-900/20 transition-all hover:scale-[1.01] hover:shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 mt-6"
                                        >
                                            <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                                            {isSaving ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    {t("onboarding.form.save")}
                                                </div>
                                            ) : (
                                                t("onboarding.form.save")
                                            )}
                                        </button>

                                        {configError && (
                                            <motion.p
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="mt-4 text-center text-sm text-rose-400"
                                            >
                                                {configError}
                                            </motion.p>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
