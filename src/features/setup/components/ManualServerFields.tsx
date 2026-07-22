"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import type { ServerSetup } from "../hooks/useServerSetup";

/**
 * The "Advanced" manual-connection section: server name + Plex token, so a
 * server can be added without plex.tv discovery (the token field is what the
 * old wizard was missing — discovery was the only way to set it).
 */
export function ManualServerFields({ setup }: { setup: ServerSetup }) {
    const [open, setOpen] = useState(false);
    const [showToken, setShowToken] = useState(false);

    return (
        <div className="rounded-xl border border-white/5 bg-white/5">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
                <span>
                    <span className="block text-sm font-medium text-white">Advanced: manual connection</span>
                    <span className="block text-xs text-white/40">
                        Enter a server URL and token directly, without Plex account discovery
                    </span>
                </span>
                <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-4 px-4 pb-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/80">Server name (optional)</label>
                                <input
                                    type="text"
                                    value={setup.manualName}
                                    onChange={(e) => setup.setManualName(e.target.value)}
                                    placeholder="My Plex Server"
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder-white/30 transition-all focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-white/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/80">
                                    Plex token <span className="text-amber-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showToken ? "text" : "password"}
                                        value={setup.token}
                                        onChange={(e) => setup.setToken(e.target.value)}
                                        placeholder="X-Plex-Token"
                                        autoComplete="off"
                                        className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 pr-12 font-mono text-sm text-white placeholder-white/30 transition-all focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-white/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowToken(!showToken)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                                        aria-label={showToken ? "Hide token" : "Show token"}
                                    >
                                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-white/30">
                                    Fill the hostname and port above, then paste your server&apos;s token here.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
