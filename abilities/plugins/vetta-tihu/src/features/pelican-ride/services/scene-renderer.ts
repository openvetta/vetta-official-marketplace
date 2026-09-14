import type { Scene } from "../../../domain/pelican-state";

type RGB = [number, number, number];

export interface Palette {
	skyTop: RGB;
	skyBottom: RGB;
	sun: RGB;
	sunY: number; // 相对画面高度
	farHill: RGB;
	nearHill: RGB;
	ground: RGB;
	road: RGB;
	stripe: RGB;
	cloud: RGB;
	cloudAlpha: number;
	stars: number;
	moon: number;
	lamp: number;
	dim: number;
	rain: number; // 雨量 0..1
}

export const PALETTES: Record<Scene, Palette> = {
	day: {
		skyTop: [110, 190, 245],
		skyBottom: [205, 236, 255],
		sun: [255, 228, 120],
		sunY: 0.18,
		farHill: [150, 200, 150],
		nearHill: [100, 172, 104],
		ground: [124, 184, 94],
		road: [118, 118, 124],
		stripe: [246, 246, 236],
		cloud: [255, 255, 255],
		cloudAlpha: 0.92,
		stars: 0,
		moon: 0,
		lamp: 0,
		dim: 0,
		rain: 0,
	},
	dusk: {
		skyTop: [74, 62, 134],
		skyBottom: [255, 152, 92],
		sun: [255, 118, 60],
		sunY: 0.6,
		farHill: [128, 92, 122],
		nearHill: [92, 70, 92],
		ground: [98, 88, 72],
		road: [92, 86, 92],
		stripe: [232, 212, 180],
		cloud: [255, 182, 150],
		cloudAlpha: 0.75,
		stars: 0.25,
		moon: 0.15,
		lamp: 0.55,
		dim: 0.25,
		rain: 0,
	},
	night: {
		skyTop: [8, 12, 38],
		skyBottom: [34, 44, 92],
		sun: [255, 118, 60],
		sunY: 1.3,
		farHill: [30, 40, 66],
		nearHill: [22, 30, 50],
		ground: [24, 34, 40],
		road: [40, 40, 50],
		stripe: [150, 150, 140],
		cloud: [80, 92, 124],
		cloudAlpha: 0.45,
		stars: 1,
		moon: 1,
		lamp: 1,
		dim: 0.55,
		rain: 0,
	},
	rain: {
		skyTop: [92, 102, 118],
		skyBottom: [150, 160, 170],
		sun: [255, 228, 120],
		sunY: 1.3,
		farHill: [104, 128, 116],
		nearHill: [78, 108, 90],
		ground: [88, 118, 80],
		road: [82, 86, 94],
		stripe: [210, 210, 205],
		cloud: [118, 126, 140],
		cloudAlpha: 0.95,
		stars: 0,
		moon: 0,
		lamp: 0.35,
		dim: 0.2,
		rain: 1,
	},
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

export function mixPalette(a: Palette, b: Palette, t: number): Palette {
	const out = {} as Record<string, unknown>;
	for (const key of Object.keys(a) as (keyof Palette)[]) {
		const va = a[key];
		const vb = b[key];
		out[key] = Array.isArray(va) ? mixRGB(va, vb as RGB, t) : mix(va as number, vb as number, t);
	}
	return out as unknown as Palette;
}

const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** 夜间把角色颜色压暗、偏蓝。 */
const shade = (c: RGB, dim: number): string => rgba(mixRGB(c, [20, 28, 60], dim * 0.7));

export interface FrameState {
	time: number; // 秒
	distance: number; // 已骑行距离（虚拟单位）
	speed: number; // 当前平滑后的速度档位 0..10
	jumpHeight: number;
	airborne: boolean;
	bellAge: number; // 距离最近一次按铃的秒数
	bellText: string; // 铃声气泡文案，随宿主语言变化
	palette: Palette;
}

// 虚拟画布高度固定为 300，宽度随面板比例变化。
export const VIRTUAL_HEIGHT = 300;
const WHEEL_R = 23;

function hash(n: number) {
	const x = Math.sin(n * 127.1) * 43758.5453;
	return x - Math.floor(x);
}

export function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, f: FrameState) {
	const p = f.palette;
	const groundY = H * 0.74;

	// 天空
	const sky = ctx.createLinearGradient(0, 0, 0, groundY);
	sky.addColorStop(0, rgba(p.skyTop));
	sky.addColorStop(1, rgba(p.skyBottom));
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, W, H);

	// 星星
	if (p.stars > 0.01) {
		for (let i = 0; i < 70; i++) {
			const x = (hash(i) * W * 1.5 - f.distance * 0.02) % (W * 1.5);
			const sx = x < 0 ? x + W * 1.5 : x;
			const sy = hash(i + 99) * groundY * 0.7;
			const twinkle = 0.6 + 0.4 * Math.sin(f.time * 2 + i);
			ctx.fillStyle = `rgba(255,255,230,${p.stars * twinkle})`;
			ctx.fillRect(sx, sy, 1.4, 1.4);
		}
	}

	// 太阳
	const sunY = H * p.sunY;
	if (sunY < groundY + 30) {
		const glow = ctx.createRadialGradient(W * 0.78, sunY, 4, W * 0.78, sunY, 70);
		glow.addColorStop(0, rgba(p.sun, 0.55));
		glow.addColorStop(1, rgba(p.sun, 0));
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, W, H);
		ctx.fillStyle = rgba(p.sun);
		ctx.beginPath();
		ctx.arc(W * 0.78, sunY, 24, 0, Math.PI * 2);
		ctx.fill();
	}

	// 月亮
	if (p.moon > 0.01) {
		ctx.save();
		ctx.globalAlpha = p.moon;
		ctx.fillStyle = "rgba(255,248,215,0.18)";
		ctx.beginPath();
		ctx.arc(W * 0.22, H * 0.17, 34, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#fff6d6";
		ctx.beginPath();
		ctx.arc(W * 0.22, H * 0.17, 18, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = rgba(p.skyTop);
		ctx.beginPath();
		ctx.arc(W * 0.22 + 8, H * 0.17 - 5, 15, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	// 云
	const cloudCount = 5 + Math.ceil(p.rain * 5);
	for (let i = 0; i < cloudCount; i++) {
		const extra = i >= 5;
		const span = W + 160;
		let x = (hash(i + 7) * span - f.distance * 0.08 - f.time * 4) % span;
		if (x < 0) x += span;
		x -= 80;
		const y = 30 + hash(i + 3) * groundY * 0.35;
		const s = (0.7 + hash(i + 11) * 0.6) * (1 + p.rain * 0.5);
		ctx.fillStyle = rgba(p.cloud, p.cloudAlpha * (extra ? p.rain : 1));
		// 每个椭圆前 moveTo 断开子路径，避免连线；合成一条路径填充，半透明时重叠处不加深。
		ctx.beginPath();
		for (const [ex, ey, rx, ry] of [
			[0, 0, 26, 11],
			[18, -7, 18, 12],
			[-16, -3, 14, 9],
		]) {
			ctx.moveTo(x + (ex + rx) * s, y + ey * s);
			ctx.ellipse(x + ex * s, y + ey * s, rx * s, ry * s, 0, 0, Math.PI * 2);
		}
		ctx.fill("nonzero");
	}

	// 远山、近山
	drawHills(ctx, W, groundY, f.distance * 0.15, 42, 0.009, p.farHill);
	drawHills(ctx, W, groundY, f.distance * 0.4, 22, 0.021, p.nearHill);

	// 地面与路
	ctx.fillStyle = rgba(p.ground);
	ctx.fillRect(0, groundY, W, H - groundY);
	ctx.fillStyle = rgba(p.road);
	ctx.fillRect(0, groundY, W, 30);
	if (p.rain > 0.01) {
		ctx.fillStyle = `rgba(200,215,235,${0.18 * p.rain})`;
		ctx.fillRect(0, groundY + 1, W, 2);
		ctx.fillRect(0, groundY + 24, W, 1.5);
	}
	ctx.fillStyle = rgba(p.stripe);
	const stripeGap = 46;
	const off = f.distance % stripeGap;
	for (let x = -off; x < W; x += stripeGap) ctx.fillRect(x, groundY + 13, 22, 3);

	// 路灯
	const lampGap = 240;
	const lampOff = f.distance % lampGap;
	for (let x = -lampOff + 120; x < W + lampGap; x += lampGap) drawLamp(ctx, x, groundY, p);

	// 速度线
	if (f.speed > 5.5 && !f.airborne) {
		ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.5, (f.speed - 5.5) * 0.12)})`;
		ctx.lineWidth = 1.5;
		for (let i = 0; i < 6; i++) {
			const len = 14 + hash(i) * 26;
			const y = groundY - 30 - hash(i + 5) * 90;
			let x = (W / 2 - 70 - ((f.time * 400 + hash(i + 2) * 200) % 180)) | 0;
			x -= 10;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x - len, y);
			ctx.stroke();
		}
	}

	// 影子
	const cx = W / 2;
	const shadowScale = Math.max(0.35, 1 - f.jumpHeight / 140);
	ctx.fillStyle = `rgba(0,0,0,${0.22 * shadowScale})`;
	ctx.beginPath();
	ctx.ellipse(cx, groundY + 1, 70 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
	ctx.fill();

	// 车灯光束
	if (p.lamp > 0.01) {
		const hx = cx + 46;
		const hy = groundY - f.jumpHeight - 62;
		const beam = ctx.createLinearGradient(hx, hy, hx + 180, hy);
		beam.addColorStop(0, `rgba(255,240,170,${0.45 * p.lamp})`);
		beam.addColorStop(1, "rgba(255,240,170,0)");
		ctx.fillStyle = beam;
		ctx.beginPath();
		ctx.moveTo(hx, hy - 3);
		ctx.lineTo(hx + 180, groundY + 10);
		ctx.lineTo(hx + 60, groundY + 12);
		ctx.closePath();
		ctx.fill();
	}

	ctx.save();
	ctx.translate(cx, groundY - f.jumpHeight);
	drawRider(ctx, f);
	ctx.restore();

	if (p.rain > 0.01) drawRain(ctx, W, H, groundY, f);
}

function drawRain(ctx: CanvasRenderingContext2D, W: number, H: number, groundY: number, f: FrameState) {
	const amount = f.palette.rain;
	const fallBottom = groundY + 28;
	// 骑得越快，相对风越大，雨丝越斜
	const slant = 0.12 + f.speed * 0.045;
	const len = 12 + f.speed * 0.8;
	const span = W + fallBottom * slant + 40;

	ctx.strokeStyle = `rgba(215,228,245,${0.55 * amount})`;
	ctx.lineWidth = 1.1;
	ctx.lineCap = "round";
	ctx.beginPath();
	const drops = Math.round(140 * amount);
	for (let i = 0; i < drops; i++) {
		const speed = 420 + hash(i + 31) * 160;
		const y = (hash(i + 17) * fallBottom + f.time * speed) % fallBottom;
		let x = (hash(i + 5) * span - y * slant - f.distance * 0.6) % span;
		if (x < 0) x += span;
		x -= 20;
		ctx.moveTo(x, y);
		ctx.lineTo(x + slant * len, y - len);
	}
	ctx.stroke();

	// 路面水花
	ctx.strokeStyle = `rgba(220,232,248,${0.6 * amount})`;
	ctx.lineWidth = 1;
	for (let i = 0; i < Math.round(16 * amount); i++) {
		const cycle = f.time * 2.2 + hash(i + 71);
		const life = cycle % 1;
		const seed = i * 13 + Math.floor(cycle);
		const x = hash(seed) * W;
		const y = groundY + 3 + hash(seed + 1) * 24;
		ctx.globalAlpha = 1 - life;
		ctx.beginPath();
		ctx.ellipse(x, y, 1 + life * 6, 0.5 + life * 1.6, 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;

	// 偶尔一道闪电的白光
	const flashCycle = (f.time % 9) / 9;
	if (flashCycle > 0.93) {
		const k = Math.sin(((flashCycle - 0.93) / 0.07) * Math.PI * 3);
		ctx.fillStyle = `rgba(255,255,255,${Math.max(0, k) * 0.18 * amount})`;
		ctx.fillRect(0, 0, W, H);
	}
}

function drawHills(ctx: CanvasRenderingContext2D, W: number, baseY: number, offset: number, amp: number, freq: number, color: RGB) {
	ctx.fillStyle = rgba(color);
	ctx.beginPath();
	ctx.moveTo(0, baseY);
	for (let x = 0; x <= W; x += 6) {
		const u = x + offset;
		const y = baseY - amp - amp * 0.6 * Math.sin(u * freq) - amp * 0.35 * Math.sin(u * freq * 2.7 + 1.3);
		ctx.lineTo(x, y);
	}
	ctx.lineTo(W, baseY);
	ctx.closePath();
	ctx.fill();
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, groundY: number, p: Palette) {
	const top = groundY - 110;
	if (p.lamp > 0.01) {
		const g = ctx.createRadialGradient(x + 12, top + 4, 2, x + 12, top + 4, 60);
		g.addColorStop(0, `rgba(255,225,140,${0.55 * p.lamp})`);
		g.addColorStop(1, "rgba(255,225,140,0)");
		ctx.fillStyle = g;
		ctx.fillRect(x - 60, top - 60, 140, 140);
	}
	ctx.strokeStyle = shade([70, 74, 84], p.dim);
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(x, groundY);
	ctx.lineTo(x, top);
	ctx.quadraticCurveTo(x, top - 6, x + 12, top - 4);
	ctx.stroke();
	ctx.fillStyle = p.lamp > 0.3 ? `rgba(255,236,160,${0.4 + 0.6 * p.lamp})` : shade([200, 200, 190], p.dim);
	ctx.beginPath();
	ctx.ellipse(x + 13, top, 6, 3, 0, 0, Math.PI * 2);
	ctx.fill();
}

type Pt = { x: number; y: number };

/** 二段骨骼 IK：膝盖取朝前（x 更大）的解。 */
function solveKnee(hip: Pt, foot: Pt, a: number, b: number): Pt {
	const dx = foot.x - hip.x;
	const dy = foot.y - hip.y;
	const d = Math.min(Math.hypot(dx, dy), a + b - 0.01);
	const base = Math.atan2(dy, dx);
	const off = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
	const k1 = { x: hip.x + a * Math.cos(base + off), y: hip.y + a * Math.sin(base + off) };
	const k2 = { x: hip.x + a * Math.cos(base - off), y: hip.y + a * Math.sin(base - off) };
	return k1.x > k2.x ? k1 : k2;
}

function drawRider(ctx: CanvasRenderingContext2D, f: FrameState) {
	const dim = f.palette.dim;
	const crank = f.distance / 14;
	const wheelAngle = f.distance / WHEEL_R;
	const bob = f.speed > 0.1 && !f.airborne ? Math.sin(crank * 2) * 1.2 : 0;

	const rear = { x: -46, y: -WHEEL_R - 1 };
	const front = { x: 46, y: -WHEEL_R - 1 };
	const bb = { x: -4, y: -WHEEL_R - 1 };
	const seat = { x: -22, y: -64 };
	const head = { x: 30, y: -58 };
	const grip = { x: 36, y: -71 };
	const hip = { x: -20, y: -70 + bob };
	const crankR = 11;
	const pedal = (a: number) => ({ x: bb.x + crankR * Math.cos(a), y: bb.y + crankR * Math.sin(a) });

	const orange = [245, 150, 40] as RGB;
	const darkOrange = [200, 110, 30] as RGB;

	// 远侧腿
	drawLeg(ctx, hip, pedal(crank + Math.PI), shade(darkOrange, dim));

	// 轮子
	for (const w of [rear, front]) drawWheel(ctx, w, wheelAngle, dim);

	// 车架
	ctx.strokeStyle = shade([220, 50, 60], dim);
	ctx.lineWidth = 4;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.beginPath();
	ctx.moveTo(rear.x, rear.y);
	ctx.lineTo(bb.x, bb.y);
	ctx.lineTo(seat.x, seat.y + 4);
	ctx.lineTo(rear.x, rear.y);
	ctx.moveTo(bb.x, bb.y);
	ctx.lineTo(head.x, head.y);
	ctx.lineTo(seat.x + 2, seat.y + 6);
	ctx.moveTo(head.x, head.y);
	ctx.lineTo(front.x, front.y);
	ctx.stroke();

	// 车把与铃铛
	ctx.strokeStyle = shade([60, 60, 70], dim);
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(head.x, head.y);
	ctx.lineTo(grip.x - 2, grip.y + 2);
	ctx.lineTo(grip.x + 6, grip.y);
	ctx.stroke();
	const ringing = f.bellAge < 0.6;
	const shake = ringing ? Math.sin(f.bellAge * 70) * 0.35 * (1 - f.bellAge / 0.6) : 0;
	ctx.save();
	ctx.translate(grip.x + 4, grip.y - 2);
	ctx.rotate(shake);
	ctx.fillStyle = shade([250, 205, 50], dim);
	ctx.beginPath();
	ctx.arc(0, 0, 4.5, Math.PI, 0);
	ctx.lineTo(4.5, 1);
	ctx.lineTo(-4.5, 1);
	ctx.closePath();
	ctx.fill();
	ctx.restore();

	// 车座
	ctx.fillStyle = shade([40, 40, 48], dim);
	ctx.beginPath();
	ctx.ellipse(seat.x, seat.y, 10, 3.5, -0.1, 0, Math.PI * 2);
	ctx.fill();

	// 车灯
	ctx.fillStyle = f.palette.lamp > 0.3 ? "#fff3b0" : shade([230, 230, 230], dim);
	ctx.beginPath();
	ctx.arc(44, -62, 3, 0, Math.PI * 2);
	ctx.fill();

	// 曲柄
	const p1 = pedal(crank);
	const p2 = pedal(crank + Math.PI);
	ctx.strokeStyle = shade([50, 50, 58], dim);
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.moveTo(p2.x, p2.y);
	ctx.lineTo(p1.x, p1.y);
	ctx.stroke();

	// 尾羽
	const body = { x: -14, y: -92 + bob };
	ctx.fillStyle = shade([225, 225, 220], dim);
	ctx.beginPath();
	ctx.moveTo(body.x - 20, body.y + 2);
	ctx.lineTo(body.x - 44, body.y + 12);
	ctx.lineTo(body.x - 38, body.y + 2);
	ctx.lineTo(body.x - 46, body.y - 4);
	ctx.closePath();
	ctx.fill();

	// 身体
	ctx.fillStyle = shade([248, 248, 244], dim);
	ctx.beginPath();
	ctx.ellipse(body.x, body.y, 28, 21, -0.35, 0, Math.PI * 2);
	ctx.fill();

	// 脖子（S 形）
	const neckBase = { x: body.x + 16, y: body.y - 12 };
	const headC = { x: 20, y: -134 + bob * 1.5 };
	ctx.strokeStyle = shade([248, 248, 244], dim);
	ctx.lineWidth = 11;
	ctx.beginPath();
	ctx.moveTo(neckBase.x, neckBase.y);
	ctx.bezierCurveTo(neckBase.x + 16, neckBase.y - 8, headC.x - 16, headC.y + 18, headC.x, headC.y);
	ctx.stroke();

	// 头
	ctx.fillStyle = shade([250, 250, 246], dim);
	ctx.beginPath();
	ctx.arc(headC.x, headC.y, 11, 0, Math.PI * 2);
	ctx.fill();
	// 头顶一撮黄毛
	ctx.fillStyle = shade([250, 220, 120], dim);
	ctx.beginPath();
	ctx.ellipse(headC.x - 6, headC.y - 9, 6, 3, -0.5, 0, Math.PI * 2);
	ctx.fill();

	// 喙袋
	const beakTip = { x: headC.x + 58, y: headC.y + 10 };
	ctx.fillStyle = shade([240, 120, 70], dim);
	ctx.beginPath();
	ctx.moveTo(headC.x + 6, headC.y + 4);
	ctx.quadraticCurveTo(headC.x + 22, headC.y + 34, beakTip.x - 6, beakTip.y);
	ctx.lineTo(headC.x + 8, headC.y + 1);
	ctx.closePath();
	ctx.fill();
	// 上喙
	ctx.fillStyle = shade([250, 180, 60], dim);
	ctx.beginPath();
	ctx.moveTo(headC.x + 5, headC.y - 3);
	ctx.quadraticCurveTo(headC.x + 36, headC.y - 1, beakTip.x, beakTip.y);
	ctx.quadraticCurveTo(headC.x + 34, headC.y + 5, headC.x + 6, headC.y + 3);
	ctx.closePath();
	ctx.fill();

	// 眼睛
	ctx.fillStyle = "#1a1a1a";
	ctx.beginPath();
	ctx.arc(headC.x + 3, headC.y - 3, 2.4, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#ffffff";
	ctx.beginPath();
	ctx.arc(headC.x + 3.8, headC.y - 3.8, 0.8, 0, Math.PI * 2);
	ctx.fill();

	// 翅膀（伸向车把）
	const flap = f.airborne ? -10 : 0;
	const shoulder = { x: body.x + 6, y: body.y - 8 };
	ctx.fillStyle = shade([226, 228, 226], dim);
	ctx.beginPath();
	ctx.moveTo(shoulder.x - 18, shoulder.y + 2);
	ctx.quadraticCurveTo(shoulder.x + 8, shoulder.y - 14 + flap, grip.x + 2, grip.y + flap * 0.4);
	ctx.quadraticCurveTo(shoulder.x + 10, shoulder.y + 18, shoulder.x - 18, shoulder.y + 10);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = shade([70, 70, 80], dim);
	ctx.beginPath();
	ctx.moveTo(grip.x + 3, grip.y + flap * 0.4);
	ctx.lineTo(grip.x - 12, grip.y - 4 + flap * 0.4);
	ctx.lineTo(grip.x - 10, grip.y + 5 + flap * 0.2);
	ctx.closePath();
	ctx.fill();

	// 近侧腿
	drawLeg(ctx, hip, p1, shade(orange, dim));

	// 铃声气泡
	if (f.bellAge < 1.4) {
		const a = f.bellAge < 1 ? 1 : 1 - (f.bellAge - 1) / 0.4;
		const rise = f.bellAge * 14;
		ctx.save();
		ctx.globalAlpha = Math.max(0, a);
		ctx.fillStyle = "#ffffff";
		ctx.strokeStyle = "#333333";
		ctx.lineWidth = 1.5;
		const bx = grip.x + 18;
		const by = grip.y - 44 - rise;
		ctx.font = "bold 12px system-ui, sans-serif";
		const bubbleWidth = Math.max(64, Math.ceil(ctx.measureText(f.bellText).width) + 18);
		roundRect(ctx, bx, by, bubbleWidth, 24, 10);
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(bx + 10, by + 24);
		ctx.lineTo(bx + 2, by + 34);
		ctx.lineTo(bx + 20, by + 24);
		ctx.fill();
		ctx.fillStyle = "#222222";
		ctx.textBaseline = "middle";
		ctx.fillText(f.bellText, bx + 9, by + 12.5);
		ctx.restore();
	}
}

function drawLeg(ctx: CanvasRenderingContext2D, hip: Pt, foot: Pt, color: string) {
	const knee = solveKnee(hip, foot, 31, 31);
	ctx.strokeStyle = color;
	ctx.lineWidth = 3.5;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(hip.x, hip.y);
	ctx.lineTo(knee.x, knee.y);
	ctx.lineTo(foot.x, foot.y);
	ctx.stroke();
	// 蹼
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(foot.x - 4, foot.y);
	ctx.lineTo(foot.x + 9, foot.y - 3);
	ctx.lineTo(foot.x + 9, foot.y + 3);
	ctx.closePath();
	ctx.fill();
}

function drawWheel(ctx: CanvasRenderingContext2D, c: Pt, angle: number, dim: number) {
	ctx.strokeStyle = shade([35, 35, 40], dim);
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.arc(c.x, c.y, WHEEL_R, 0, Math.PI * 2);
	ctx.stroke();
	ctx.strokeStyle = shade([175, 175, 185], dim);
	ctx.lineWidth = 1;
	for (let i = 0; i < 6; i++) {
		const a = angle + (i * Math.PI) / 3;
		ctx.beginPath();
		ctx.moveTo(c.x, c.y);
		ctx.lineTo(c.x + (WHEEL_R - 2) * Math.cos(a), c.y + (WHEEL_R - 2) * Math.sin(a));
		ctx.stroke();
	}
	ctx.fillStyle = shade([90, 90, 100], dim);
	ctx.beginPath();
	ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
	ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}
