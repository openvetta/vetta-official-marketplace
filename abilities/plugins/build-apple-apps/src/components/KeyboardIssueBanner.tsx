import { useTranslation } from "@vetta-org/plugin-sdk";
import type { JSX } from "react";
import type { KeyboardIssue } from "../runtime/serve-sim-command.js";

interface KeyboardIssueBannerProps {
	readonly issue: KeyboardIssue;
	readonly onDismiss: () => void;
}

/**
 * 键盘送不进模拟器时的面板提示。点击与滑动不受影响，所以只是一条可关闭的横幅，不挡住画面。
 * 原因原样附在后面：分类之外的情况用户和我们都需要那句原文。
 *
 * 不提供「打开系统设置」按钮：宿主的 openExternal 只放行 http/https，`x-apple.systempreferences:`
 * 深链会被拒绝，所以设置路径直接写在文案里。
 */
export function KeyboardIssueBanner({ issue, onDismiss }: KeyboardIssueBannerProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="flex flex-shrink-0 flex-col gap-2 border-b border-border bg-card px-3 py-2.5 text-xs leading-relaxed">
			<div className="flex items-start gap-2">
				<p className="min-w-0 flex-1">
					<span className="font-medium">{t("keyboard.title")}</span>{" "}
					<span className="text-muted-foreground">{t(`keyboard.${issue.kind}`, { device: issue.device })}</span>
				</p>
				<button
					type="button"
					className="ios-sim-icon-button flex-shrink-0"
					title={t("keyboard.dismiss")}
					aria-label={t("keyboard.dismiss")}
					onClick={onDismiss}
				>
					×
				</button>
			</div>
			<p className="font-mono text-[11px] text-muted-foreground">{issue.reason}</p>
		</div>
	);
}
