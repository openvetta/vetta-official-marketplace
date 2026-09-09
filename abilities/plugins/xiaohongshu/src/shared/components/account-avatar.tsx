import { useEffect, useState, type ReactElement } from "react";
import { accountInitial, type XhsAccount } from "../../xhs";

export function AccountAvatar({
	account,
	size = "size-10",
}: {
	account: Pick<XhsAccount, "name" | "nickname" | "avatarUrl">;
	size?: string;
}): ReactElement {
	const [imageFailed, setImageFailed] = useState(false);
	useEffect(() => setImageFailed(false), [account.avatarUrl]);
	const showImage = Boolean(account.avatarUrl && !imageFailed);
	return (
		<div
			className={`relative flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-sm font-bold text-white shadow-sm ring-1 ring-white/10`}
			aria-hidden="true"
		>
			{showImage ? (
				<img
					src={account.avatarUrl}
					alt=""
					className="size-full object-cover"
					onError={() => setImageFailed(true)}
				/>
			) : accountInitial(account)}
		</div>
	);
}
