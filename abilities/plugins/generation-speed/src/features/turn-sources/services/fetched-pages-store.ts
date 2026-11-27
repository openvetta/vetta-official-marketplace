import type { ConversationEvent } from "@vetta-org/plugin-sdk";
import { urlsFromToolArgs } from "../../../domain/turn-sources";

const EMPTY: readonly string[] = [];

/**
 * 记录本轮工具打开过的网址（宿主事件只推实时调用，不提供历史）。
 * 按会话分开保存；该会话出现新的用户消息时清空，工具调用失败的网址移除。
 * 只存在内存里：插件重载或应用重启前的轮次不会补回来。
 */
export class FetchedPagesStore {
	private sessionId: string | null = null;
	private readonly bySession = new Map<string, readonly string[]>();
	private readonly callUrls = new Map<string, { sessionId: string; urls: string[] }>();
	private readonly listeners = new Set<() => void>();

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	/** 当前活动会话本轮打开过的网址，按出现顺序。 */
	getSnapshot = (): readonly string[] => (this.sessionId ? (this.bySession.get(this.sessionId) ?? EMPTY) : EMPTY);

	handle(event: ConversationEvent): void {
		switch (event.type) {
			case "conversation-changed":
				this.sessionId = event.conversation.id;
				this.emit();
				return;
			case "message-added":
				if (event.message.role === "user" && this.sessionId) this.update(this.sessionId, () => EMPTY);
				return;
			case "tool-call-start": {
				const urls = urlsFromToolArgs(event.args);
				if (!this.sessionId || urls.length === 0) return;
				this.callUrls.set(event.toolCallId, { sessionId: this.sessionId, urls });
				this.update(this.sessionId, (current) => [...current, ...urls.filter((url) => !current.includes(url))]);
				return;
			}
			case "tool-call-end": {
				const call = this.callUrls.get(event.toolCallId);
				this.callUrls.delete(event.toolCallId);
				if (call && event.isError) {
					this.update(call.sessionId, (current) => current.filter((url) => !call.urls.includes(url)));
				}
				return;
			}
			default:
				return;
		}
	}

	private update(sessionId: string, next: (current: readonly string[]) => readonly string[]): void {
		const current = this.bySession.get(sessionId) ?? EMPTY;
		const updated = next(current);
		if (updated === current) return;
		this.bySession.set(sessionId, updated);
		if (sessionId === this.sessionId) this.emit();
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}

export const fetchedPagesStore = new FetchedPagesStore();
