import type { ReactNode } from "react";

/**
 * One line-icon family for the dashboard stat cards: 24px grid, 1.75 stroke,
 * no fills — the previous set mixed filled and outlined glyphs from different
 * packs at different weights.
 */
const Icon = ({ children, className = "w-5 h-5" }: { children: ReactNode; className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={className}
    >
        {children}
    </svg>
);

type IconProps = { className?: string };

export const StreamsIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M22 12C22 14.7578 20.8836 17.2549 19.0782 19.064M2 12C2 9.235 3.12222 6.73208 4.93603 4.92188M19.1414 5.00003C19.987 5.86254 20.6775 6.87757 21.1679 8.00003M5 19.1415C4.08988 18.2493 3.34958 17.1845 2.83209 16" />
        <path d="M16.2849 8.04397C17.3458 9.05877 18 10.4488 18 11.9822C18 13.5338 17.3302 14.9386 16.2469 15.9564M7.8 16C6.68918 14.9789 6 13.556 6 11.9822C6 10.4266 6.67333 9.01843 7.76162 8" />
        <path d="M13.6563 10.4511C14.5521 11.1088 15 11.4376 15 12C15 12.5624 14.5521 12.8912 13.6563 13.5489C13.4091 13.7304 13.1638 13.9014 12.9384 14.0438C12.7407 14.1688 12.5168 14.298 12.2849 14.4249C11.3913 14.914 10.9444 15.1586 10.5437 14.8878C10.1429 14.617 10.1065 14.0502 10.0337 12.9166C10.0131 12.596 10 12.2817 10 12C10 11.7183 10.0131 11.404 10.0337 11.0834C10.1065 9.94977 10.1429 9.38296 10.5437 9.1122C10.9444 8.84144 11.3913 9.08599 12.2849 9.57509C12.5168 9.70198 12.7407 9.83123 12.9384 9.95619C13.1638 10.0986 13.4091 10.2696 13.6563 10.4511Z" />
    </Icon>
);

export const DirectPlayIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8.9v6.2a.6.6 0 0 0 .92.5l4.8-3.1a.6.6 0 0 0 0-1l-4.8-3.1a.6.6 0 0 0-.92.5Z" />
    </Icon>
);

/** Remux: same streams, repackaged into a new container — a loop, not a transfer. */
export const DirectStreamIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </Icon>
);

export const TranscodeIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </Icon>
);

export const BandwidthIcon = ({ className }: IconProps) => (
    <Icon className={className}>
        <path d="M17.7453 16C18.5362 14.8661 19 13.4872 19 12C19 11.4851 18.9444 10.9832 18.8389 10.5M6.25469 16C5.46381 14.8662 5 13.4872 5 12C5 8.13401 8.13401 5 12 5C12.4221 5 12.8355 5.03737 13.2371 5.10897M16.4999 7.5L11.9999 12M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM13 12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12Z" />
    </Icon>
);
