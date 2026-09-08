import type { ReactElement } from "react";
import { accountInitial, type XhsAccount } from "../../xhs";

export function AccountAvatar({
	account,
	size = "size-10",
}: {
	account: Pick<XhsAccount, "name" | "nickname">;
	size?: string;
}): ReactElement {
	return (
		<div
			className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-sm font-bold text-white shadow-sm ring-1 ring-white/10`}
			aria-hidden="true"
		>
			{accountInitial(account)}
		</div>
	);
}
