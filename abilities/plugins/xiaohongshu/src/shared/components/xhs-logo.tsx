import type { ReactElement } from "react";

export function XhsLogo({ size = "size-5" }: { size?: string }): ReactElement {
	return (
		<div
			className={`inline-flex ${size} shrink-0 items-center justify-center rounded-lg bg-[#ff2442] text-xs font-black text-white shadow-sm`}
			aria-hidden="true"
		>
			小
		</div>
	);
}
