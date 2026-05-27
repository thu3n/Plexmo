import { motion, type Variants } from "framer-motion";

interface LoginStepProps {
    containerVariants: Variants;
    isAuthenticating: boolean;
    loginError: string;
    onLogin: () => void;
    /** Translation function from the language context. */
    t: (key: string) => string;
}

/**
 * Onboarding step 1: sign in with Plex. Triggers the popup-based OAuth flow via
 * onLogin; the parent owns the auth state and polling.
 */
export default function LoginStep({ containerVariants, isAuthenticating, loginError, onLogin, t }: LoginStepProps) {
    return (
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
                    onClick={onLogin}
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
    );
}
