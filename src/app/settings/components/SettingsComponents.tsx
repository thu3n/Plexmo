import React from "react";

import clsx from "clsx";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function SettingsSection({
    title,
    description,
    children,
    className
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}) {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const shouldTruncate = description && description.length > 150;

    return (
        <section className={clsx("space-y-6 md:space-y-8", className)}>
            {(title || description) && (
                <div className="mb-6 md:mb-8 space-y-2">
                    {title && (
                        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                            {title}
                        </h2>
                    )}
                    {description && (
                        <div className="relative max-w-2xl">
                            <p
                                className={clsx(
                                    "text-sm md:text-base text-white/50 leading-relaxed transition-all duration-300",
                                    !isExpanded && shouldTruncate ? "line-clamp-2" : ""
                                )}
                            >
                                {description}
                            </p>

                            {!isExpanded && shouldTruncate && (
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c15] to-transparent pointer-events-none" />
                            )}

                            {shouldTruncate && (
                                <div className={clsx("flex justify-center w-full", !isExpanded && "absolute bottom-0 z-10")}>
                                    <button
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className="text-white/50 hover:text-white transition-colors p-2 focus:outline-none"
                                        title={isExpanded ? "Show less" : "Read more"}
                                    >
                                        <ChevronDown className={clsx("w-5 h-5 transition-transform duration-300", isExpanded && "rotate-180")} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            <div className="space-y-4 md:space-y-6">
                {children}
            </div>
        </section>
    );
}

export function SettingsCard({
    children,
    className,
    onClick,
    style
}: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    style?: React.CSSProperties;
}) {
    return (
        <motion.div
            whileHover={onClick ? { y: -2, transition: { duration: 0.2 } } : undefined}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={clsx(
                "rounded-2xl md:rounded-3xl border border-white/5 bg-white/[0.03] backdrop-blur-2xl p-5 md:p-8 relative overflow-hidden group transition-all duration-300",
                onClick && "cursor-pointer hover:bg-white/[0.06] hover:border-white/10 hover:shadow-2xl hover:shadow-black/50",
                className
            )}
            onClick={onClick}
            style={style}
        >
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Inner gloss reflection */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

            <div className="relative z-10 w-full">
                {children}
            </div>
        </motion.div>
    );
}
