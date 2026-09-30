import { Activity, Cpu, Pause, Play, PlayCircle, Server, ServerCrash, ShieldAlert, Square, XCircle, type LucideIcon } from "lucide-react";
import type { NotificationEventId } from "../lib/events";

export const EVENT_ICONS: Record<NotificationEventId, LucideIcon> = {
    start: Play,
    stop: Square,
    pause: Pause,
    resume: PlayCircle,
    transcode: Cpu,
    terminate: XCircle,
    rule_violation: ShieldAlert,
    server_down: ServerCrash,
    server_up: Server,
    anomaly: Activity,
};
