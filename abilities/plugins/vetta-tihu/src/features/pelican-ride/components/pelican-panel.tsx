import { useActivityTab, useTranslation } from "@vetta-org/plugin-sdk";
import { useRef, useSyncExternalStore } from "react";
import { MAX_SPEED, pelicanStore, sceneLabelKey } from "../../../domain/pelican-state";
import type { Notify } from "../../../shared/notify";
import { usePelicanAnimation } from "../hooks/use-pelican-animation";

/** 活动面板组件零 props，notify 通过闭包注入。 */
export function createPelicanPanel(notify: Notify) {
	return function PelicanPanel() {
		const { active } = useActivityTab();
		const { t } = useTranslation();
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const state = useSyncExternalStore(pelicanStore.subscribe, pelicanStore.getState);

		usePelicanAnimation({
			canvasRef,
			active,
			bellText: t("panel.bellSound"),
			notify,
			messages: { canvasFailed: t("error.canvas"), bellFailed: t("error.bell") },
		});

		return (
			<div className="relative flex h-full w-full flex-col overflow-hidden bg-card text-foreground select-none">
				<canvas ref={canvasRef} className="block min-h-0 w-full flex-1" />
				<div className="pointer-events-none absolute top-2 left-2 rounded-md bg-black/40 px-2 py-1 text-xs text-white">
					{t("panel.status", { speed: state.speed, max: MAX_SPEED, scene: t(sceneLabelKey(state.scene)) })}
				</div>
				<div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{t("panel.hint")}</div>
			</div>
		);
	};
}
