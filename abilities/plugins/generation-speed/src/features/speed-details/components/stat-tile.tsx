/** 详情对话框里的一格指标：上方名称，下方数值。 */
export function StatTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex min-w-0 flex-col gap-1 rounded-xl bg-muted/50 px-3 py-2.5">
			<span className="truncate text-xs text-muted-foreground">{label}</span>
			<span className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</span>
		</div>
	);
}
