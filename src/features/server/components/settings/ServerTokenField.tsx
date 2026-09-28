"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";

const FIELD_BUTTON = "px-4 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl transition-colors text-white/70 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500";

export function ServerTokenField({
    id,
    value,
    onChange,
    canReveal,
    showToken,
    onToggleShow,
    justCopied,
    onCopy,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    /** Only saved servers have a masked token that needs fetching to reveal. */
    canReveal: boolean;
    showToken: boolean;
    onToggleShow: () => void;
    justCopied: boolean;
    onCopy: () => void;
}) {
    return (
        <div>
            <label htmlFor={id} className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">
                Token
            </label>
            <div className="flex items-stretch gap-2">
                <input
                    id={id}
                    type={showToken ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none font-mono"
                    required
                />
                {canReveal && (
                    <button
                        type="button"
                        onClick={onToggleShow}
                        aria-label={showToken ? "Hide token" : "Show full token"}
                        aria-pressed={showToken}
                        title={showToken ? "Hide token" : "Show full token"}
                        className={FIELD_BUTTON}
                    >
                        {showToken ? <EyeOff className="w-5 h-5" aria-hidden /> : <Eye className="w-5 h-5" aria-hidden />}
                    </button>
                )}
                <button type="button" onClick={onCopy} aria-label="Copy full token" title="Copy full token" className={FIELD_BUTTON}>
                    {justCopied ? <Check className="w-5 h-5 text-emerald-400" aria-hidden /> : <Copy className="w-5 h-5" aria-hidden />}
                </button>
            </div>
            <span className="sr-only" aria-live="polite">
                {justCopied ? "Token copied" : ""}
            </span>
        </div>
    );
}
