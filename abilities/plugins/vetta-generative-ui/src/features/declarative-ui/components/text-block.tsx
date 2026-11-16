export function TextBlock({ text, muted }: { text: string; muted?: boolean }) {
    return (
        <p className={`whitespace-pre-line ${muted ? "text-[13px] text-muted-foreground" : "text-sm leading-relaxed text-foreground"}`}>{text}</p>
    );
}
