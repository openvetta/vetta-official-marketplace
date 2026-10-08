import { useTranslation } from "@vetta-org/plugin-sdk";
import { type JSX, useEffect, useState } from "react";
import { getPluginCtx } from "../plugin-context.js";
import type { PanelSettings } from "../runtime/panel-settings.js";
import { getRuntimeController } from "../runtime/runtime-instance.js";
import { SERVE_SIM_PACKAGE } from "../runtime/serve-sim-command.js";
import { buildPreviewUrl } from "../runtime/serve-url.js";
import { getSettingsStore } from "../runtime/settings-instance.js";
import type { RuntimeState } from "../runtime/simulator-runtime.js";
import { DeviceIcon } from "./icons.js";

function statusText(state: RuntimeState, t: (key: string, params?: Record<string, string>) => string): string {
	switch (state.phase) {
		case "running":
			return t("settings.service.running", { port: String(state.port ?? "?") });
		case "starting":
			return t("settings.service.starting");
		case "failed":
			return t("settings.service.failed");
		case "unsupported":
			return t("settings.service.unsupported");
		default:
			return t("settings.service.stopped");
	}
}

function dotColor(state: RuntimeState): string {
	if (state.phase === "running") return "#22c55e";
	if (state.phase === "starting") return "#f59e0b";
	if (state.phase === "failed" || state.phase === "unsupported") return "var(--destructive, #ef4444)";
	return "var(--muted-foreground)";
}

function Toggle(props: {
	readonly checked: boolean;
	readonly title: string;
	readonly description: string;
	readonly onChange: (next: boolean) => void;
}): JSX.Element {
	return (
		<label className="flex cursor-pointer items-start gap-3">
			<input
				type="checkbox"
				className="mt-0.5 size-3.5 flex-shrink-0 accent-[var(--primary)]"
				checked={props.checked}
				onChange={(event) => props.onChange(event.target.checked)}
			/>
			<span className="flex min-w-0 flex-col gap-1">
				<span className="text-[13px] leading-none">{props.title}</span>
				<span className="text-xs leading-relaxed text-muted-foreground">{props.description}</span>
			</span>
		</label>
	);
}

/** 工作区配置页：服务状态与控制、插件自身的开关。 */
export function SettingsView(): JSX.Element {
	const { t } = useTranslation();
	const controller = getRuntimeController();
	const store = getSettingsStore();
	const [state, setState] = useState<RuntimeState>(() => controller.current());
	const [settings, setSettings] = useState<PanelSettings>(() => store.current());

	useEffect(() => controller.subscribe(setState), [controller]);
	useEffect(() => store.subscribe(setSettings), [store]);
	useEffect(() => {
		void store.load();
	}, [store]);

	const running = state.phase === "running" && state.port !== undefined;
	const busy = state.phase === "starting" || state.phase === "unsupported";

	return (
		<div className="ios-sim-page">
			<div className="ios-sim-page-inner">
				<header className="flex items-start gap-4">
					<span className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--foreground)_7%,transparent)] text-muted-foreground">
						<DeviceIcon />
					</span>
					<div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
						<h1 className="text-xl font-semibold tracking-tight">{t("settings.title")}</h1>
						<p className="text-sm leading-relaxed text-muted-foreground">{t("settings.tagline")}</p>
					</div>
				</header>

				<section className="flex flex-col gap-2.5">
					<span className="ios-sim-section-label">{t("settings.service.heading")}</span>
					<div className="ios-sim-card flex flex-col gap-3 p-4">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
							<span
								className={`ios-sim-dot${state.phase === "starting" ? " ios-sim-pulse" : ""}`}
								style={{ background: dotColor(state) }}
								aria-hidden="true"
							/>
							<h2 className="text-sm font-medium">{statusText(state, t)}</h2>
							<div className="ms-auto flex flex-wrap items-center gap-2">
								<button
									type="button"
									className="ios-sim-button-ghost"
									disabled={busy}
									onClick={() => void (running ? controller.restart() : controller.ensureServer())}
								>
									{running ? t("settings.service.restart") : t("settings.service.start")}
								</button>
								<button
									type="button"
									className="ios-sim-button-ghost"
									disabled={!running}
									onClick={() => {
										if (state.port === undefined) return;
										void getPluginCtx()
											.ui.openExternal(buildPreviewUrl(state.port))
											.catch((error: unknown) =>
												getPluginCtx().ui.notify({ message: t("panel.openExternalFailed"), error }),
											);
									}}
								>
									{t("panel.openExternal")}
								</button>
							</div>
						</div>
						<p className="text-xs leading-relaxed text-muted-foreground">
							{t("settings.service.hint", { package: SERVE_SIM_PACKAGE })}
						</p>
						{state.phase === "failed" && state.commandDisabled ? (
							<p className="text-xs leading-relaxed text-muted-foreground">{t("panel.commandDisabled.body")}</p>
						) : null}
						{state.phase === "failed" && state.failure ? <pre className="ios-sim-output">{state.failure}</pre> : null}
					</div>
				</section>

				<section className="flex flex-col gap-2.5">
					<span className="ios-sim-section-label">{t("settings.options.heading")}</span>
					<div className="ios-sim-card flex flex-col gap-4 p-4">
						<Toggle
							checked={settings.alwaysShowTab}
							title={t("settings.options.alwaysShowTab.title")}
							description={t("settings.options.alwaysShowTab.description")}
							onChange={(next) => void store.update({ alwaysShowTab: next })}
						/>
						<Toggle
							checked={settings.autoStartServer}
							title={t("settings.options.autoStartServer.title")}
							description={t("settings.options.autoStartServer.description")}
							onChange={(next) => void store.update({ autoStartServer: next })}
						/>
					</div>
				</section>

				<footer className="flex flex-col gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
					<p>{t("settings.footer.credit")}</p>
					<p>{t("settings.footer.agent")}</p>
				</footer>
			</div>
		</div>
	);
}
