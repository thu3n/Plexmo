import { ReactNode } from "react";

export const SummaryCard = ({
    label,
    value,
    detail,
    accent,
    icon,
    onClick,
    className = "",
    detailClassName = "",
}: {
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    accent: string;
    icon: ReactNode;
    onClick?: () => void;
    className?: string; // Allow external sizing/hiding
    detailClassName?: string; // Allow hiding details specifically
}) => (
    <div
        onClick={onClick}
        className={`glass-panel glass-panel-hover flex flex-col justify-between gap-3 p-5 rounded-2xl h-full cursor-pointer transition-all ${className}`}
    >
        {/* Main Row: Icon + Info */}
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 shadow-lg ${accent}`}>
                    {icon}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 leading-tight truncate mb-0.5">{label}</span>
                    <span className="text-2xl font-bold text-white leading-none tracking-tight truncate filter drop-shadow-sm">{value}</span>
                </div>
            </div>
        </div>

        {/* Detail Row */}
        {detail ? (
            <div className={`w-full pt-3 mt-auto border-t border-white/5 ${detailClassName}`}>
                {detail}
            </div>
        ) : null}
    </div>
);
