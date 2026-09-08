import { useCallback, useState } from "react";

export function useCopyAccountId(userId: string | undefined): {
	copied: boolean;
	copy: () => void;
} {
	const [copied, setCopied] = useState(false);

	const copy = useCallback(() => {
		if (!userId) return;
		void navigator.clipboard.writeText(userId);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 2000);
	}, [userId]);

	return { copied, copy };
}
