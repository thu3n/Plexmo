"use client";

import { useLanguage } from "@/components/LanguageContext";
import { motion } from "framer-motion";

type StepProps = {
    currentStep: number;
};

export function OnboardingSteps({ currentStep }: StepProps) {
    const { t } = useLanguage();

    const steps = [
        { id: 1, label: t("onboarding.steps.signin") || "Sign in with Plex" },
        { id: 2, label: t("onboarding.steps.configure") || "Configure Plex" },
    ];

    return (
        <div className="w-full max-w-lg mx-auto mb-12">
            <div className="relative flex justify-between px-10">
                {/* Connecting Line background */}
                <div className="absolute top-5 left-14 right-14 h-0.5 bg-white/10 -z-10" />

                {/* Active Line Progress */}
                <motion.div
                    className="absolute top-5 left-14 h-0.5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] -z-10"
                    initial={{ width: "0%" }}
                    animate={{
                        width: currentStep === 1 ? "0%" : "calc(100% - 7rem)"
                    }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                />

                {steps.map((step) => {
                    const isActive = currentStep === step.id;
                    const isCompleted = currentStep > step.id;

                    return (
                        <div key={step.id} className="relative flex flex-col items-center gap-3">
                            <motion.div
                                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-500 z-10 ${isActive
                                        ? "border-amber-500 bg-slate-900 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                                        : isCompleted
                                            ? "border-amber-500 bg-amber-500 text-slate-950"
                                            : "border-white/10 bg-slate-900 text-white/30"
                                    }`}
                                animate={{
                                    scale: isActive ? 1.1 : 1,
                                    borderColor: isActive || isCompleted ? "rgba(245, 158, 11, 1)" : "rgba(255, 255, 255, 0.1)"
                                }}
                            >
                                {isCompleted ? (
                                    <motion.svg
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"
                                    >
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </motion.svg>
                                ) : (
                                    <span className="font-bold text-sm">{step.id}</span>
                                )}

                                {/* Active Glow Ring */}
                                {isActive && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full border border-amber-500"
                                        initial={{ scale: 1, opacity: 1 }}
                                        animate={{ scale: 1.5, opacity: 0 }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                    />
                                )}
                            </motion.div>

                            <motion.span
                                className={`text-sm font-medium tracking-wide ${isActive ? "text-white" : "text-white/40"}`}
                                animate={{ opacity: isActive || isCompleted ? 1 : 0.4 }}
                            >
                                {step.label}
                            </motion.span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
