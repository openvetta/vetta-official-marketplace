import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

export function ModalDialog({
	title,
	description,
	onClose,
	children,
	footer,
	maxWidth = "max-w-md",
}: {
	title: string;
	description?: string;
	onClose: () => void;
	children: ReactNode;
	footer?: ReactNode;
	maxWidth?: string;
}): ReactElement {
	const panel = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null;
		panel.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			previous?.focus?.();
		};
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				ref={panel}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				tabIndex={-1}
				className={`flex w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl outline-none`}
			>
				<header className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
					<div className="min-w-0 pr-3">
						<h3 className="m-0 truncate text-sm font-semibold text-foreground">
							{title}
						</h3>
						{description ? (
							<p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
								{description}
							</p>
						) : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						aria-label="关闭"
					>
						<span className="text-base leading-none">✕</span>
					</button>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
					{children}
				</div>
				{footer ? (
					<footer className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/15 px-5 py-3">
						{footer}
					</footer>
				) : null}
			</div>
		</div>
	);
}
