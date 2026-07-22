"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

const floatingGradientVariants: Variants = {
    animate: {
        scale: [1, 1.2, 1],
        rotate: [0, 90, 0],
        opacity: [0.3, 0.5, 0.3],
        transition: { duration: 15, repeat: Infinity, ease: "linear" as const },
    },
};

/** Full-page onboarding chrome: ambient background, logo, heading — shared by /setup and /invite. */
export function SetupShell({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: ReactNode;
}) {
    return (
        <div className="relative min-h-dvh safe-x w-full overflow-hidden bg-slate-950 font-sans selection:bg-amber-500/30">
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

            <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center p-6">
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
                            className="h-full w-full object-contain rounded-2xl"
                        />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2 drop-shadow-sm">{title}</h1>
                    {subtitle && (
                        <p className="text-lg text-slate-400 max-w-md mx-auto leading-relaxed">{subtitle}</p>
                    )}
                </motion.div>
                {children}
            </div>
        </div>
    );
}
