/** Inline validation message; role=alert so it is announced when it appears. */
export default function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) return null;
    return (
        <p id={id} role="alert" className="text-xs text-rose-400 mt-1.5">
            {message}
        </p>
    );
}
