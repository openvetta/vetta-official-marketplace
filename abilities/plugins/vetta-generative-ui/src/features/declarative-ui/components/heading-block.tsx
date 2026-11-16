const SIZES = { 1: "text-xl", 2: "text-base", 3: "text-sm" } as const;

export function HeadingBlock({ text, level = 2 }: { text: string; level?: 1 | 2 | 3 }) {
    const Tag = `h${level + 1}` as "h2" | "h3" | "h4";
    return <Tag className={`${SIZES[level]} font-semibold tracking-tight text-foreground`}>{text}</Tag>;
}
