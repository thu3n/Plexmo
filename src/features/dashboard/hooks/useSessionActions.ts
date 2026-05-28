import { useState } from "react";

export const useSessionActions = () => {
    const [isTerminating, setIsTerminating] = useState(false);

    const stopStream = async (sessionId: string, serverId: string | undefined, onSuccess?: () => void) => {
        if (!sessionId) {
            alert("Unable to stop stream: Session ID missing. Please refresh the page.");
            console.error("Missing sessionId/sessionKey");
            return;
        }

        setIsTerminating(true);
        try {
            const res = await fetch("/api/session/terminate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: sessionId,
                    serverId: serverId,
                    reason: "Stopped by Admin"
                })
            });

            if (!res.ok) throw new Error("Failed to stop stream");

            if (onSuccess) onSuccess();

        } catch (error) {
            console.error("Stop stream error:", error);
            alert("Failed to stop stream");
        } finally {
            setIsTerminating(false);
        }
    };

    return { stopStream, isTerminating };
};
