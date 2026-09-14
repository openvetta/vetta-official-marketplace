// 鹈鹕骑车的共享状态：AI 工具 handler 写入，活动 Tab 的动画循环读取。
// 面板没有任何交互控件，状态只能经 agent 工具修改。

export const SCENES = ["day", "dusk", "night", "rain"] as const;
export type Scene = (typeof SCENES)[number];

export const MAX_SPEED = 10;
/** 单次指令允许的跳跃/按铃次数上限，也是排队中待执行动作的上限。 */
export const MAX_ACTION_COUNT = 5;
const MAX_PENDING = MAX_ACTION_COUNT;

export function isScene(value: unknown): value is Scene {
	return typeof value === "string" && (SCENES as readonly string[]).includes(value);
}

/** 场景在插件 locales catalog 中的裸 key。 */
export function sceneLabelKey(scene: Scene) {
	return `scene.${scene}`;
}

export interface PelicanState {
	speed: number;
	scene: Scene;
	pendingJumps: number;
	pendingBells: number;
	totalJumps: number;
	totalBells: number;
}

const INITIAL_STATE: PelicanState = {
	speed: 3,
	scene: "day",
	pendingJumps: 0,
	pendingBells: 0,
	totalJumps: 0,
	totalBells: 0,
};

let state: PelicanState = INITIAL_STATE;

const listeners = new Set<() => void>();

function update(patch: Partial<PelicanState>) {
	state = { ...state, ...patch };
	for (const listener of listeners) listener();
}

export const pelicanStore = {
	getState: () => state,
	subscribe(listener: () => void) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	setSpeed(speed: number) {
		update({ speed: Math.max(0, Math.min(MAX_SPEED, Math.round(speed))) });
	},
	setScene(scene: Scene) {
		update({ scene });
	},
	requestJumps(count: number) {
		update({
			pendingJumps: Math.min(MAX_PENDING, state.pendingJumps + count),
			totalJumps: state.totalJumps + count,
		});
	},
	requestBells(count: number) {
		update({
			pendingBells: Math.min(MAX_PENDING, state.pendingBells + count),
			totalBells: state.totalBells + count,
		});
	},
	/** 动画循环消费一次跳跃请求；没有待处理请求时返回 false。 */
	consumeJump() {
		if (state.pendingJumps <= 0) return false;
		update({ pendingJumps: state.pendingJumps - 1 });
		return true;
	},
	consumeBell() {
		if (state.pendingBells <= 0) return false;
		update({ pendingBells: state.pendingBells - 1 });
		return true;
	},
	/** 恢复初始状态，供测试隔离使用。 */
	reset() {
		update(INITIAL_STATE);
	},
};
