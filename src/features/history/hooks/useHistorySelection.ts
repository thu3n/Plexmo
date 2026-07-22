"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HistoryEntry } from "@/lib/history";

export function useHistorySelection(onDeleteSuccess?: () => void) {
    const router = useRouter();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    const toggleSelection = (id: string, e?: React.SyntheticEvent) => {
        e?.stopPropagation();
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleGroupSelection = (entries: HistoryEntry[]) => {
        const ids = entries.map(e => e.id);
        const allSelected = ids.every(id => selectedIds.has(id));
        const newSelected = new Set(selectedIds);
        if (allSelected) ids.forEach(id => newSelected.delete(id));
        else ids.forEach(id => newSelected.add(id));
        setSelectedIds(newSelected);
    };

    const deleteSelected = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) return;
        setIsDeleting(true);
        try {
            await fetch("/api/history", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            setSelectedIds(new Set());
            if (onDeleteSuccess) onDeleteSuccess();
            router.refresh();
            // Force reload to ensure deep state clean if needed, matching original behavior
            window.location.reload();
        } catch (error) {
            alert("Failed to delete items");
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    return {
        selectedIds,
        isDeleting,
        toggleSelection,
        toggleGroupSelection,
        deleteSelected
    };
}
