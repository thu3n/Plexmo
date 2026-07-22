"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

/** Variable-step wizard indicator: numbered dots, labels, animated progress line. */
export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
    return (
        <div className="mb-10 flex items-center justify-center">
            {steps.map((label, index) => (
                <div key={label} className="flex items-center">
                    <div className="flex flex-col items-center gap-2">
                        <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition-colors ${
                                index < current
                                    ? "border-amber-500 bg-amber-500 text-slate-950"
                                    : index === current
                                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                                      : "border-white/10 bg-white/5 text-white/30"
                            }`}
                        >
                            {index < current ? <Check className="h-4 w-4" /> : index + 1}
                        </div>
                        <span
                            className={`text-[11px] font-semibold uppercase tracking-wider ${
                                index <= current ? "text-white/70" : "text-white/25"
                            }`}
                        >
                            {label}
                        </span>
                    </div>
                    {index < steps.length - 1 && (
                        <div className="relative mx-3 mb-6 h-0.5 w-12 overflow-hidden rounded-full bg-white/10 sm:w-20">
                            <motion.div
                                className="absolute inset-y-0 left-0 bg-amber-500"
                                initial={false}
                                animate={{ width: index < current ? "100%" : "0%" }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
