import { type RefObject, useEffect, useRef } from "react";
import { pelicanStore } from "../../../domain/pelican-state";
import type { Notify } from "../../../shared/notify";
import { playBell } from "../services/bell-sound";
import { drawFrame, mixPalette, type Palette, PALETTES, VIRTUAL_HEIGHT } from "../services/scene-renderer";

const GRAVITY = 1400;
const JUMP_VELOCITY = 450;
const SCENE_FADE_SECONDS = 1.2;
const BELL_GAP_SECONDS = 0.5;
/** 每档速度对应的前进速度（虚拟单位/秒）。 */
const UNITS_PER_SPEED = 45;

interface PelicanAnimationOptions {
	canvasRef: RefObject<HTMLCanvasElement | null>;
	active: boolean;
	bellText: string;
	notify: Notify;
	messages: { canvasFailed: string; bellFailed: string };
}

/** 面板激活时驱动动画循环：消费 store 里的跳跃/铃铛请求，并按场景渐变绘制。 */
export function usePelicanAnimation({ canvasRef, active, bellText, notify, messages }: PelicanAnimationOptions) {
	// 语言切换不应重启动画循环，文案通过 ref 读取最新值。
	const latest = useRef({ bellText, messages });
	latest.current = { bellText, messages };

	useEffect(() => {
		if (!active) return;
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) {
			notify({
				message: latest.current.messages.canvasFailed,
				error: new Error("CanvasRenderingContext2D unavailable"),
			});
			return;
		}

		let raf = 0;
		let last = performance.now();
		let time = 0;
		let distance = 0;
		let speed = pelicanStore.getState().speed;
		let jumpHeight = 0;
		let jumpVelocity = 0;
		let airborne = false;
		let bellAge = 99;
		let bellCooldown = 0;
		let scene = pelicanStore.getState().scene;
		let fromPalette: Palette = PALETTES[scene];
		let fade = 1;

		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			time += dt;
			const s = pelicanStore.getState();

			// 速度平滑趋近目标档位
			speed += (s.speed - speed) * Math.min(1, dt * 2.5);
			if (Math.abs(s.speed - speed) < 0.01) speed = s.speed;
			distance += speed * UNITS_PER_SPEED * dt;

			// 跳跃
			if (!airborne && pelicanStore.consumeJump()) {
				airborne = true;
				jumpVelocity = JUMP_VELOCITY;
			}
			if (airborne) {
				jumpVelocity -= GRAVITY * dt;
				jumpHeight += jumpVelocity * dt;
				if (jumpHeight <= 0) {
					jumpHeight = 0;
					airborne = false;
				}
			}

			// 铃铛
			bellAge += dt;
			bellCooldown -= dt;
			if (bellCooldown <= 0 && pelicanStore.consumeBell()) {
				bellAge = 0;
				bellCooldown = BELL_GAP_SECONDS;
				try {
					playBell();
				} catch (error) {
					notify({ message: latest.current.messages.bellFailed, error });
				}
			}

			// 场景渐变
			if (s.scene !== scene) {
				fromPalette = fade < 1 ? mixPalette(fromPalette, PALETTES[scene], fade) : PALETTES[scene];
				scene = s.scene;
				fade = 0;
			}
			fade = Math.min(1, fade + dt / SCENE_FADE_SECONDS);
			const eased = fade * fade * (3 - 2 * fade);
			const palette = fade >= 1 ? PALETTES[scene] : mixPalette(fromPalette, PALETTES[scene], eased);

			// 适配面板尺寸与 DPR
			const dpr = window.devicePixelRatio || 1;
			const cssW = canvas.clientWidth;
			const cssH = canvas.clientHeight;
			if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
				canvas.width = Math.round(cssW * dpr);
				canvas.height = Math.round(cssH * dpr);
			}
			if (cssW > 0 && cssH > 0) {
				const scale = cssH / VIRTUAL_HEIGHT;
				ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
				drawFrame(ctx, cssW / scale, VIRTUAL_HEIGHT, {
					time,
					distance,
					speed,
					jumpHeight,
					airborne,
					bellAge,
					bellText: latest.current.bellText,
					palette,
				});
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [active, canvasRef, notify]);
}
