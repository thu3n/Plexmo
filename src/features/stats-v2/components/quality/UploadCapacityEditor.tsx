"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { LINK_CLASS } from "../../lib/theme";
import { useUploadCapacityEditor } from "../../hooks/quality";

/** Inline "Upload: 100 Mbps" label; owners get an edit affordance, everyone else sees the value. */
export function UploadCapacityEditor({
    capacityMbps,
    onSaved,
}: {
    capacityMbps: number | null;
    onSaved: () => void;
}) {
    const { canEdit, saving, error, save } = useUploadCapacityEditor(onSaved);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");

    const startEdit = () => {
        setDraft(capacityMbps === null ? "" : String(capacityMbps));
        setEditing(true);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const trimmed = draft.trim();
        const ok = await save(trimmed === "" ? null : Number(trimmed));
        if (ok) setEditing(false);
    };

    if (editing) {
        return (
            <form onSubmit={submit} className="flex flex-wrap items-center gap-2 text-xs">
                <label htmlFor="upload-capacity" className="text-white/55">Upload</label>
                <input
                    id="upload-capacity"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Mbps"
                    autoFocus
                    className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white tabular-nums outline-none focus:border-amber-400/50"
                />
                <span className="text-white/55">Mbps</span>
                <button type="submit" disabled={saving} className={`font-medium ${LINK_CLASS} disabled:opacity-50`}>
                    Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className="text-white/55 hover:text-white">
                    Cancel
                </button>
                {error && <span className="w-full text-rose-400">{error}</span>}
            </form>
        );
    }

    const label = capacityMbps === null ? "Upload not set" : `Upload ${capacityMbps} Mbps`;
    if (!canEdit) {
        return capacityMbps === null ? null : <span className="text-xs text-white/55">{label}</span>;
    }
    return (
        <button type="button" onClick={startEdit} className={`inline-flex items-center gap-1 text-xs font-medium ${LINK_CLASS}`}>
            {label}
            <Pencil className="h-3 w-3" aria-hidden />
        </button>
    );
}
