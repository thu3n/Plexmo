import cronstrue from "cronstrue";

export const formatCron = (cron: string): string => {
    try {
        let str = cronstrue.toString(cron, { use24HourTimeFormat: true });

        // Remove concise "At 0 minutes past the hour, " which cronstrue adds for "0 */x" items
        str = str.replace("At 0 minutes past the hour, ", "");

        // Ensure first letter is capitalized after replacement
        if (str.length > 0) {
            str = str.charAt(0).toUpperCase() + str.slice(1);
        }

        return str;
    } catch {
        return "Invalid Schedule";
    }
};
