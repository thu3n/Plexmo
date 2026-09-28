/** Counts embedded in a Tautulli API import job's completion message ("Imported: 12, Skipped: 3, ..."). */
export type ImportStats = { imported: number; skipped: number; failed: number; fixed: number };

const countOf = (message: string, label: string): number => {
    const m = new RegExp(`${label}:\\s*(\\d+)`).exec(message);
    return m ? Number(m[1]) : 0;
};

export const parseImportStats = (message: string | null | undefined): ImportStats => {
    const msg = message ?? "";
    return {
        imported: countOf(msg, "Imported"),
        skipped: countOf(msg, "Skipped"),
        failed: countOf(msg, "Failed"),
        fixed: countOf(msg, "Fixed"),
    };
};
