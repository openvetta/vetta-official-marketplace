import type { ReactElement } from "react";
import { STATUS_META, type UiStatus } from "../state/status";

export function StatusLine({
	status,
	label,
}: {
	status: UiStatus;
	label: string;
}): ReactElement {
	const meta = STATUS_META[status];
	return (
		<span
			className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.tone}`}
		>
			<span
				className={`size-1.5 rounded-full ${meta.dot}`}
				aria-hidden="true"
			/>
			{label}
		</span>
	);
}
