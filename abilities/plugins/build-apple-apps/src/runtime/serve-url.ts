/**
 * serve-sim 的页面地址。
 *
 * 面板直接内嵌 serve-sim 自带的预览页，而不是自己解码 MJPEG、自己发手势：它已经处理好
 * 画面流、触摸与键盘转发、旋转、截图和多设备切换，重写只会得到一个更差的子集。
 *
 * 用 127.0.0.1 而不是 localhost：服务只监听回环地址，写死 IPv4 免得解析到 ::1 时连不上。
 */

const HOST = "127.0.0.1";

export function buildPreviewUrl(port: number): string {
	return `http://${HOST}:${port}/`;
}
