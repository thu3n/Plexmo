import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { PlexResource, FlatConnection } from "@/lib/plex-utils";

interface ServerConfigStepProps {
    containerVariants: Variants;
    servers: PlexResource[];
    flatConnections: FlatConnection[];
    selectedServerIdentifier: string;
    hostname: string;
    port: string;
    useSsl: boolean;
    isLoadingServers: boolean;
    isTesting: boolean;
    isSaving: boolean;
    testResult: { success: boolean; message: string } | null;
    configError: string | null;
    onSelectConnection: (connectionId: string) => void;
    onFetchServers: () => void;
    setHostname: (value: string) => void;
    setPort: (value: string) => void;
    setUseSsl: (value: boolean) => void;
    onTestConnection: () => void;
    onSave: (e: React.FormEvent) => void;
    /** Translation function from the language context. */
    t: (key: string) => string;
}

/**
 * Onboarding step 2: pick/enter the Plex server connection (host/port/SSL/token),
 * verify it, and save. All state and handlers live in the parent; this renders
 * the form and delegates events back up.
 */
export default function ServerConfigStep({
    containerVariants,
    servers,
    flatConnections,
    selectedServerIdentifier,
    hostname,
    port,
    useSsl,
    isLoadingServers,
    isTesting,
    isSaving,
    testResult,
    configError,
    onSelectConnection,
    onFetchServers,
    setHostname,
    setPort,
    setUseSsl,
    onTestConnection,
    onSave,
    t,
}: ServerConfigStepProps) {
    return (
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

                <form onSubmit={onSave} className="space-y-8">

                    {/* Server Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-white/80">{t("session.server")}</label>
                        <div className="flex gap-3">
                            <div className="relative flex-1 group">
                                <select
                                    value={selectedServerIdentifier}
                                    onChange={(e) => onSelectConnection(e.target.value)}
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
                                onClick={onFetchServers}
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
                                onClick={onTestConnection}
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
    );
}
