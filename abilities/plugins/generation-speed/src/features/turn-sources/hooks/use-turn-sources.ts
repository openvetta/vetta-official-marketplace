import { useConversationMessages } from "@vetta-org/plugin-sdk";
import { useMemo, useSyncExternalStore } from "react";
import { extractReplyLinks, latestReplyText, mergeSources, type TurnSource } from "../../../domain/turn-sources";
import { fetchedPagesStore } from "../services/fetched-pages-store";

/** 最新一轮的来源：回复引用的链接 + 本轮工具打开过的网页，去重合并。 */
export function useTurnSources(): TurnSource[] {
	const messages = useConversationMessages();
	const fetched = useSyncExternalStore(fetchedPagesStore.subscribe, fetchedPagesStore.getSnapshot);
	const replyText = latestReplyText(messages);
	return useMemo(() => mergeSources(extractReplyLinks(replyText), fetched), [replyText, fetched]);
}
