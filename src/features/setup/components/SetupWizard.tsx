"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { usePlexPin } from "../hooks/usePlexPin";
import { useServerSetup } from "../hooks/useServerSetup";
import { StepIndicator } from "./StepIndicator";
import LoginStep from "./LoginStep";
import ServerConfigStep from "./ServerConfigStep";
import { RestoreStep } from "./RestoreStep";

export type SetupMode = "setup" | "invite-onboarding" | "invite-access";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const containerVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } },
};

/**
 * Shared onboarding wizard. Three modes:
 * - `setup`: first-run (Sign in → Connect server → Done)
 * - `invite-onboarding`: invited friend connects THEIR server (same steps;
 *   the invite token rides along in the OAuth poll)
 * - `invite-access`: invited viewer (Sign in → Done)
 */
export function SetupWizard({
    mode,
    inviteToken,
    loginExtra,
}: {
    mode: SetupMode;
    inviteToken?: string;
    loginExtra?: React.ReactNode;
}) {
    const { t } = useLanguage();
    const { data: userData, mutate: mutateUser } = useSWR("/api/auth/me", fetcher);
    const isAuthenticated = Boolean(userData && userData.user);
    const [saved, setSaved] = useState(false);
    const [showRestore, setShowRestore] = useState(false);

    const hasServerStep = mode !== "invite-access";
    const done = hasServerStep ? saved : isAuthenticated;

    const pin = usePlexPin({
        inviteToken,
        onSuccess: async () => {
            await mutateUser();
        },
    });
    const setup = useServerSetup({
        onSaved: () => setSaved(true),
        onUnauthorized: () => mutateUser(),
    });

    const steps = hasServerStep
        ? [t("login.signInWithPlex"), "Connect server", "Done"]
        : [t("login.signInWithPlex"), "Done"];
    const current = done ? steps.length - 1 : isAuthenticated ? 1 : 0;

    const goToApp = () => {
        // Hard navigation: the freshest cookie (owner upgrade / viewer session)
        // must be what middleware sees on the next page load.
        window.location.href = "/";
    };

    // First-run alternative path: restore a full backup instead of setting up.
    if (mode === "setup" && showRestore && !isAuthenticated && !done) {
        return (
            <AnimatePresence mode="wait">
                <RestoreStep onBack={() => setShowRestore(false)} />
            </AnimatePresence>
        );
    }

    return (
        <>
            <StepIndicator steps={steps} current={current} />
            <AnimatePresence mode="wait">
                {done ? (
                    <motion.div
                        key="step-done"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="w-full max-w-md"
                    >
                        <div className="glass-panel rounded-2xl p-10 text-center backdrop-blur-xl">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.15 }}
                                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                            >
                                <CheckCircle2 className="h-9 w-9" />
                            </motion.div>
                            <h2 className="mb-2 text-2xl font-semibold text-white">You&apos;re all set</h2>
                            <p className="mb-8 text-sm text-slate-400">
                                {mode === "invite-access"
                                    ? "Your Plex account now has access to this Plexmo instance."
                                    : "Your Plex server is connected and monitoring starts right away."}
                            </p>
                            <button
                                onClick={goToApp}
                                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 font-bold text-white shadow-xl shadow-amber-900/20 transition-all hover:scale-[1.01] hover:shadow-amber-500/30"
                            >
                                Go to dashboard
                            </button>
                        </div>
                    </motion.div>
                ) : !isAuthenticated ? (
                    <div key="step-login" className="w-full flex flex-col items-center gap-4">
                        <LoginStep
                            containerVariants={containerVariants}
                            isAuthenticating={pin.isAuthenticating}
                            loginError={pin.loginError}
                            linkCode={pin.linkCode}
                            onLogin={pin.login}
                            t={t}
                        />
                        {mode === "setup" && (
                            <button
                                onClick={() => setShowRestore(true)}
                                className="text-sm text-white/40 underline-offset-4 transition hover:text-white hover:underline"
                            >
                                or restore from a backup
                            </button>
                        )}
                        {loginExtra}
                    </div>
                ) : (
                    <ServerConfigStep containerVariants={containerVariants} setup={setup} t={t} />
                )}
            </AnimatePresence>
        </>
    );
}
