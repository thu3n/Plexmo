import { motion, AnimatePresence, type Variants } from "framer-motion";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import type { ServerSetup } from "../hooks/useServerSetup";
import { ManualServerFields } from "./ManualServerFields";

interface ServerConfigStepProps {
    containerVariants: Variants;
    setup: ServerSetup;
    /** Translation function from the language context. */
    t: (key: string) => string;
}

/**
 * Wizard step: pick a discovered Plex connection (or enter one manually via
 * the Advanced section, incl. token), verify it, and save.
 */
export default function ServerConfigStep({ containerVariants, setup, t }: ServerConfigStepProps) {
    return (
        <motion.div
            key="step-server"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-2xl"
        >
            <div className="glass-panel overflow-hidden rounded-2xl p-8 backdrop-blur-xl">
                <div className="mb-8 flex gap-4 rounded-xl bg-indigo-500/10 p-5 border border-indigo-500/20">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-medium text-indigo-200">Connect your Plex server</h3>
                        <p className="text-sm text-indigo-200/70 leading-relaxed">
                            {t("onboarding.form.serverPlaceholder")}
                        </p>
                    </div>
                </div>

                <form onSubmit={setup.save} className="space-y-6">
                    {/* Discovery */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-white/80">{t("session.server")}</label>
                        <div className="flex gap-3">
                            <div className="relative flex-1 group">
                                <select
                                    value={setup.selectedServerIdentifier}
                                    onChange={(e) => setup.selectConnection(e.target.value)}
                                    disabled={setup.servers.length === 0}
                                    className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/40 px-5 py-4 text-white placeholder-white/30 transition-all focus:border-amber-500 focus:bg-slate-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 hover:border-white/20 cursor-pointer"
                                >
                                    <option value="">{t("onboarding.form.selectServer")}</option>
                                    {setup.flatConnections.map((conn) => (
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
                                onClick={setup.fetchServers}
                                disabled={setup.isLoadingServers}
                                className="flex items-center justify-center rounded-xl bg-white/5 border border-white/10 px-5 py-2 text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-50 transition-all active:scale-95"
                                title={t("onboarding.form.loadServers")}
                            >
                                <RefreshCw className={`h-5 w-5 text-white/80 ${setup.isLoadingServers ? "animate-spin text-amber-500" : ""}`} />
                            </button>
                        </div>
                    </div>

                    {/* Connection details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-3">
                            <label className="text-sm font-medium text-white/80">{t("onboarding.form.hostname")} <span className="text-amber-500">*</span></label>
                            <input
                                type="text"
                                value={setup.hostname}
                                onChange={(e) => setup.setHostname(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-5 py-4 text-white placeholder-white/30 transition-all focus:border-amber-500 focus:bg-slate-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-white/20"
                                placeholder="http://127.0.0.1"
                                required
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-white/80">{t("onboarding.form.port")} <span className="text-amber-500">*</span></label>
                            <input
                                type="text"
                                value={setup.port}
                                onChange={(e) => setup.setPort(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-5 py-4 text-white placeholder-white/30 transition-all focus:border-amber-500 focus:bg-slate-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-white/20"
                                placeholder="32400"
                                required
                            />
                        </div>
                    </div>

                    {/* SSL Toggle */}
                    <div className="flex items-center justify-between rounded-xl bg-white/5 p-4 border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">{t("onboarding.form.useSsl")}</span>
                            <span className="text-xs text-white/40">Enable if your server uses HTTPS</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setup.setUseSsl(!setup.useSsl)}
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${setup.useSsl ? "bg-amber-500" : "bg-slate-700"}`}
                        >
                            <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${setup.useSsl ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* Advanced: manual name + token */}
                    <ManualServerFields setup={setup} />

                    {/* Actions */}
                    <div className="space-y-4 pt-2">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={setup.testConnection}
                                disabled={setup.isTesting || !setup.hostname || !setup.token}
                                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-4 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/20 disabled:opacity-50"
                            >
                                {setup.isTesting ? "Testing..." : t("onboarding.form.verify") || "Verify Connection"}
                            </button>
                            <AnimatePresence>
                                {setup.testResult && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className={`mt-3 flex items-center gap-3 rounded-lg p-3 text-sm border ${setup.testResult.success ? "bg-green-500/10 text-green-300 border-green-500/20" : "bg-rose-500/10 text-rose-300 border-rose-500/20"}`}
                                    >
                                        {setup.testResult.success ? (
                                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                                        ) : (
                                            <XCircle className="w-5 h-5 shrink-0" />
                                        )}
                                        {setup.testResult.message}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button
                            type="submit"
                            disabled={setup.isSaving || !setup.token}
                            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 font-bold text-white shadow-xl shadow-amber-900/20 transition-all hover:scale-[1.01] hover:shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 mt-4"
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                            {setup.isSaving ? (
                                <span className="flex items-center justify-center gap-2">
                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                    {t("onboarding.form.save")}
                                </span>
                            ) : (
                                t("onboarding.form.save")
                            )}
                        </button>

                        {setup.configError && (
                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center text-sm text-rose-400">
                                {setup.configError}
                            </motion.p>
                        )}
                    </div>
                </form>
            </div>
        </motion.div>
    );
}
