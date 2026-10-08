import { useActivityTab, useTranslation } from "@vetta-org/plugin-sdk";
import { type JSX, useCallback, useEffect, useState } from "react";
import type { PanelSettings } from "../runtime/panel-settings.js";
import { getRuntimeController } from "../runtime/runtime-instance.js";
import { buildPreviewUrl } from "../runtime/serve-url.js";
import { getSettingsStore } from "../runtime/settings-instance.js";
import type { RuntimeState } from "../runtime/simulator-runtime.js";
import { SimulatorWebview } from "./SimulatorWebview.js";

function CenteredNotice({
	title,
	message,
	action,
}: {
	readonly title?: string;
	readonly message: string;
	readonly action?: { readonly label: string; readonly onClick: () => void };
}): JSX.Element {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
			{title ? <p className="text-sm font-medium">{title}</p> : null}
			<p className="text-xs leading-relaxed text-muted-foreground">{message}</p>
			{action ? (
				<button type="button" className="ios-sim-button" onClick={action.onClick}>
					{action.label}
				</button>
			) : null}
		</div>
	);
}

/**
 * 活动 Tab 面板。
 *
 * 画面、触摸、键盘、旋转与设备切换都由内嵌的 serve-sim 预览页提供；这里只做两件事：
 * 拉起服务，以及把它的预览页放进面板。
 */
export function SimulatorPanel(): JSX.Element {
	const { t } = useTranslation();
	const { active } = useActivityTab();
	const controller = getRuntimeController();
	const store = getSettingsStore();
	const [state, setState] = useState<RuntimeState>(() => controller.current());
	const [settings, setSettings] = useState<PanelSettings>(() => store.current());

	useEffect(() => controller.subscribe(setState), [controller]);
	useEffect(() => store.subscribe(setSettings), [store]);
	useEffect(() => {
		if (active) void store.load();
	}, [active, store]);

	const start = useCallback((): void => {
		void controller.ensureServer();
	}, [controller]);

	// 服务只在真的要看画面时才起，且整个插件共用一个。失败后不自动重试，等用户点。
	useEffect(() => {
		if (active && settings.autoStartServer && state.phase === "idle") start();
	}, [active, settings.autoStartServer, start, state.phase]);

	switch (state.phase) {
		case "unsupported":
			return <CenteredNotice title={t("panel.unsupported.title")} message={t("panel.unsupported.body")} />;
		case "starting":
			return <CenteredNotice message={t("panel.starting")} />;
		case "idle":
			return settings.autoStartServer ? (
				<CenteredNotice message={t("panel.starting")} />
			) : (
				<CenteredNotice message={t("panel.idle")} action={{ label: t("panel.start"), onClick: start }} />
			);
		case "failed":
			return (
				<div className="flex h-full flex-col gap-3 p-5">
					<p className="text-sm font-medium">
						{state.commandDisabled ? t("panel.commandDisabled.title") : t("panel.failed")}
					</p>
					<p className="text-xs leading-relaxed text-muted-foreground">
						{state.commandDisabled ? t("panel.commandDisabled.body") : t("panel.failedHint")}
					</p>
					{state.failure ? <pre className="ios-sim-output">{state.failure}</pre> : null}
					<div>
						<button type="button" className="ios-sim-button" onClick={() => void controller.restart()}>
							{t("panel.retry")}
						</button>
					</div>
				</div>
			);
		case "running":
			break;
	}

	const url = buildPreviewUrl(state.port ?? 0);
	// 面板只放预览页本身：重启与「在浏览器中打开」在设置页里，失败时面板另有重试。
	return (
		<div className="flex h-full min-h-0 flex-col bg-background text-foreground">
			{/* key 绑端口：服务重启后重新挂载 guest。 */}
			<SimulatorWebview key={url} url={url} />
		</div>
	);
}
