import { getEventDefinition, type MessageTemplate, type NotificationEventId } from "../lib/events";
import { SAMPLE_VARS, renderMessage } from "../lib/templates";

const toHexColor = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** Discord-embed-like preview rendered with sample values (plain text; markdown shown as typed). */
export function TemplatePreview({ event, template }: { event: NotificationEventId; template: MessageTemplate }) {
    const { title, description } = renderMessage(event, SAMPLE_VARS, { [event]: template });
    return (
        <div aria-label="Preview" className="rounded-xl bg-[#2b2d31] p-4 border-l-4" style={{ borderLeftColor: toHexColor(getEventDefinition(event).color) }}>
            <p className="text-sm font-bold text-white break-words">{title}</p>
            {description && <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap break-words">{description}</p>}
            <p className="mt-3 text-[11px] text-white/40">Plexmo · preview with sample values</p>
        </div>
    );
}
