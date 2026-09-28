import React from "react";

import clsx from "clsx";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function SettingsSection({
    title,
    description,
    children,
    className,
    // Vertical stack by default. Pages that lay their content out as a grid pass
    // their own classes here — `space-y-*` emits margins that stack on top of
    // `gap`, so it has to be replaced rather than extended.
    contentClassName = "space-y-4 md:space-y-6"
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
    contentClassName?: string;
}) {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const descriptionId = React.useId();
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
                                id={descriptionId}
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
                                        type="button"
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className="text-white/50 hover:text-white transition-colors p-2 focus:outline-none focus-visible:text-white"
                                        title={isExpanded ? "Show less" : "Read more"}
                                        aria-label={isExpanded ? "Show less" : "Read more"}
                                        aria-expanded={isExpanded}
                                        aria-controls={descriptionId}
                                    >
                                        <ChevronDown aria-hidden className={clsx("w-5 h-5 transition-transform duration-300", isExpanded && "rotate-180")} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            <div className={contentClassName}>
                {children}
            </div>
        </section>
    );
}

const CARD_BASE =
    "rounded-2xl md:rounded-3xl border border-white/5 bg-white/[0.03] backdrop-blur-2xl p-5 md:p-8 relative overflow-hidden group transition-all duration-300";
const CARD_CLICKABLE = "cursor-pointer hover:bg-white/[0.06] hover:border-white/10 hover:shadow-2xl hover:shadow-black/50";
const CARD_HOVER_LIFT = { y: -2, transition: { duration: 0.2 } };

function CardDecor({ children }: { children: React.ReactNode }) {
    return (
        <>
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Inner gloss reflection */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

            <div className="relative z-10 w-full">
                {children}
            </div>
        </>
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
    // Static cards (the vast majority) skip the motion wrapper entirely: it only
    // ever animated the hover lift, which non-clickable cards never use.
    if (!onClick) {
        return (
            <div className={clsx(CARD_BASE, className)} style={style}>
                <CardDecor>{children}</CardDecor>
            </div>
        );
    }

    return (
        <motion.div
            whileHover={CARD_HOVER_LIFT}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={clsx(CARD_BASE, CARD_CLICKABLE, className)}
            onClick={onClick}
            style={style}
        >
            <CardDecor>{children}</CardDecor>
        </motion.div>
    );
}
