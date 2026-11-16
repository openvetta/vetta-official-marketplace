type Cell = string | number | boolean | null;
type Column = { key: string; label: string; align?: "left" | "right" | "center" };

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

const formatCell = (value: Cell | undefined) => (value === null || value === undefined ? "—" : typeof value === "boolean" ? (value ? "✓" : "✗") : String(value));

export function TableBlock({ caption, columns, rows }: { caption?: string; columns: Column[]; rows: Array<Record<string, Cell>> }) {
    return (
        <div className="overflow-hidden rounded-xl bg-muted/50">
            <div className="max-h-[420px] overflow-auto">
                <table className="w-full border-collapse text-sm">
                    {caption ? <caption className="px-4 pt-3 pb-1 text-left text-xs text-muted-foreground">{caption}</caption> : null}
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <tr>
                            {columns.map((column) => (
                                <th key={column.key} scope="col" className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground ${ALIGN[column.align ?? "left"]}`}>
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:pb-1">
                        {rows.map((row, index) => (
                            <tr key={index} className="transition-colors hover:bg-background/60">
                                {columns.map((column) => (
                                    <td key={column.key} className={`px-4 py-2.5 text-foreground ${ALIGN[column.align ?? "left"]} ${column.align === "right" ? "tabular-nums" : ""}`}>
                                        {formatCell(row[column.key])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
