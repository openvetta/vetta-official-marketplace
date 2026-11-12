import { definePlugin } from "@vetta-org/plugin-sdk";

/**
 * Ego has no runtime code of its own: everything it adds to a conversation is
 * declared in plugin.json — the ego-browser skill and the browser-routing prompt. The entry exists because the host loads every
 * plugin through Module Federation.
 */
export default definePlugin({
	activate() {
		return () => {};
	},
});
