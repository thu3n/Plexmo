"use client";

import { Check } from "lucide-react";
import clsx from "clsx";
import { SERVER_COLORS, getServerColor } from "@/lib/serverColors";

const SWATCH = "h-8 w-8 rounded-full flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";

/**
 * Server accent color. "Auto" (empty value) keeps the id-derived palette color
 * the rest of the app already uses, so picking nothing changes nothing.
 */
export function ServerColorPicker({
    value,
    serverId,
    onChange,
}: {
    value: string;
    serverId: string | undefined;
    onChange: (color: string) => void;
}) {
    const autoColor = getServerColor(serverId);
    const selected = value.toUpperCase();
    const isCustom = Boolean(value) && !SERVER_COLORS.includes(selected);

    return (
        <fieldset>
            <legend className="block text-xs font-bold text-white/60 mb-2 uppercase tracking-wider">Color</legend>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-pressed={!value}
                    aria-label="Automatic color"
                    title="Automatic"
                    className={clsx(SWATCH, "border-2 border-dashed", !value ? "border-white" : "border-white/20")}
                    style={{ backgroundColor: `${autoColor}33` }}
                >
                    {!value && <Check className="w-4 h-4 text-white" aria-hidden />}
                </button>
                {SERVER_COLORS.map((color) => (
                    <button
                        key={color}
                        type="button"
                        onClick={() => onChange(color)}
                        aria-pressed={selected === color}
                        aria-label={`Color ${color}`}
                        className={clsx(SWATCH, selected === color && "ring-2 ring-white ring-offset-2 ring-offset-slate-900")}
                        style={{ backgroundColor: color }}
                    >
                        {selected === color && <Check className="w-4 h-4 text-slate-900" aria-hidden />}
                    </button>
                ))}
                <label
                    className={clsx(SWATCH, "relative cursor-pointer overflow-hidden border border-white/20", isCustom && "ring-2 ring-white ring-offset-2 ring-offset-slate-900")}
                    style={{ backgroundColor: isCustom ? value : "transparent" }}
                    title="Custom color"
                >
                    <span className="sr-only">Custom color</span>
                    {!isCustom && <span className="text-xs font-bold text-white/60" aria-hidden>+</span>}
                    <input
                        type="color"
                        value={isCustom ? value : autoColor}
                        onChange={(e) => onChange(e.target.value.toUpperCase())}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </label>
            </div>
        </fieldset>
    );
}
