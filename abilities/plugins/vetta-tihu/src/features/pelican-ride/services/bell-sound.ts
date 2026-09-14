// 用 Web Audio 合成两声自行车铃，不打包音频文件。

let bellAudio: AudioContext | null = null;

/** 播放一次「叮铃」；失败时抛出，由调用方上报。 */
export function playBell() {
	bellAudio ??= new AudioContext();
	const ac = bellAudio;
	if (ac.state === "suspended") void ac.resume();
	const now = ac.currentTime;
	for (const [delay, freq] of [
		[0, 2350],
		[0.16, 2350],
	] as const) {
		for (const harmonic of [1, 1.51]) {
			const osc = ac.createOscillator();
			const gain = ac.createGain();
			osc.type = "sine";
			osc.frequency.value = freq * harmonic;
			gain.gain.setValueAtTime(0.0001, now + delay);
			gain.gain.exponentialRampToValueAtTime(0.18 / harmonic, now + delay + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.7);
			osc.connect(gain).connect(ac.destination);
			osc.start(now + delay);
			osc.stop(now + delay + 0.75);
		}
	}
}
