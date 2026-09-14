import type { PluginAgentToolRegistration, PluginTranslate } from "@vetta-org/plugin-sdk";
import { isScene, MAX_ACTION_COUNT, MAX_SPEED, pelicanStore, SCENES, type Scene } from "../domain/pelican-state";
import type { Notify } from "../shared/notify";

export interface PelicanBikeControlInput {
	speed?: number;
	jumps?: number;
	ringBell?: number;
	scene?: Scene;
}

interface PelicanBikeControlDeps {
	/** 打开鹈鹕活动面板；cwd 为调用所在会话的工作目录。 */
	openPanel(cwd: string): void;
	notify: Notify;
	t: PluginTranslate;
}

export function createPelicanBikeControlTool({
	openPanel,
	notify,
	t,
}: PelicanBikeControlDeps): PluginAgentToolRegistration<PelicanBikeControlInput> {
	return {
		id: "pelican_bike_control",
		name: "pelican_bike_control",
		label: "%tool.label%",
		description: [
			'Control the bicycle-riding pelican and its scene in the "Pelican Ride" activity panel. The mini game has no buttons; this tool is the only way to operate it.',
			`Fields can be combined in one call: speed sets the riding speed level (0 stops, ${MAX_SPEED} is fastest); jumps makes the pelican jump that many times; ringBell rings the bell that many times; scene switches to day, dusk, night or rain.`,
			'Omit every field to only read the current status. When the user asks to go "faster" or "slower", adjust the returned current speed by about 2 levels.',
			"Do NOT use for real cycling, navigation, workout tracking or anything unrelated to this pelican mini game.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				speed: { type: "integer", minimum: 0, maximum: MAX_SPEED, description: `Riding speed level, 0-${MAX_SPEED}` },
				jumps: { type: "integer", minimum: 1, maximum: MAX_ACTION_COUNT, description: `Number of jumps, 1-${MAX_ACTION_COUNT}` },
				ringBell: {
					type: "integer",
					minimum: 1,
					maximum: MAX_ACTION_COUNT,
					description: `Number of bell rings, 1-${MAX_ACTION_COUNT}`,
				},
				scene: { type: "string", enum: [...SCENES], description: "day, dusk, night or rain" },
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: ({ trigger: { input }, session }) => {
			const { speed, jumps, ringBell, scene } = input ?? {};
			const invalid = (error: string) => ({ ok: false, error, status: readStatus() });

			// 先校验全部字段，避免部分动作已生效后才返回错误。
			if (speed !== undefined && (typeof speed !== "number" || !Number.isFinite(speed))) {
				return invalid(`speed must be an integer from 0 to ${MAX_SPEED}`);
			}
			if (scene !== undefined && !isScene(scene)) {
				return invalid(`scene must be one of ${SCENES.join(", ")}`);
			}

			const performed: string[] = [];
			if (speed !== undefined) {
				pelicanStore.setSpeed(speed);
				performed.push(`speed set to ${pelicanStore.getState().speed}`);
			}
			if (scene !== undefined) {
				pelicanStore.setScene(scene);
				performed.push(`scene switched to ${scene}`);
			}
			if (jumps !== undefined) {
				const count = clampCount(jumps);
				pelicanStore.requestJumps(count);
				performed.push(`jumped ${count} time(s)`);
			}
			if (ringBell !== undefined) {
				const count = clampCount(ringBell);
				pelicanStore.requestBells(count);
				performed.push(`rang the bell ${count} time(s)`);
			}

			if (performed.length > 0) {
				try {
					openPanel(session.cwd);
				} catch (error) {
					notify({ message: t("error.openPanel"), error });
				}
			}

			return {
				ok: true,
				performed: performed.length > 0 ? performed : ["status only"],
				status: readStatus(),
			};
		},
	};
}

function clampCount(value: number) {
	return Math.max(1, Math.min(MAX_ACTION_COUNT, Math.round(Number(value) || 1)));
}

function readStatus() {
	const state = pelicanStore.getState();
	return {
		speed: state.speed,
		maxSpeed: MAX_SPEED,
		scene: state.scene,
		totalJumps: state.totalJumps,
		totalBells: state.totalBells,
	};
}
