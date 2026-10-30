import type { PluginContext, PluginFileExplorerContextMenuContribution } from "@vetta-org/plugin-sdk";
import { reportError } from "../../../plugin-context";

/**
 * Targets the menu offers an investigation for.
 *
 * Two lists, because the host matches `resourceType` and it is a single value:
 * a macOS `.app` is a directory in the file tree, so `file` alone silently never
 * matches it. Extensions are lower-case, without the dot, and matched
 * case-insensitively by the host.
 *
 * Everything here is a *starting point for the agent*, not a promise that REA can
 * read it directly: a `.dmg`, `.pkg` or `.msi` needs mounting or unpacking first,
 * and the prompt tells the agent to say so instead of guessing.
 */
export const FILE_TARGET_EXTENSIONS = [
	// Desktop applications and their components.
	"app", // also the HarmonyOS package, which is a file
	"exe",
	"dll",
	"dylib",
	"so",
	"node",
	"asar",
	// Native and runtime artifacts.
	"elf",
	"bin",
	"sys",
	"efi",
	"ko",
	"macho",
	"pyc",
	"dex",
	"jar",
	"class",
	// Mobile packages.
	"apk",
	"aab",
	"xapk",
	"apks",
	"ipa",
	// Assets, models and GPU code.
	"pck",
	"unity3d",
	"gguf",
	"safetensors",
	"cubin",
	"ptx",
	"wasm",
	// Captures and diagnostics.
	"har",
	"saz",
	"pcap",
	"pcapng",
	"ips",
	"sqlite3",
	// Containers that must be mounted or unpacked before analysis.
	"dmg",
	"pkg",
	"msi",
	"crx",
	"xpi",
];

export const DIRECTORY_TARGET_EXTENSIONS = [
	"app", // the macOS bundle
	"framework",
	"appex",
	"xpc",
];

/**
 * Right-click on a target starts the investigation where the user already is.
 * The case is opened by the agent through `case_open`, so the prompt has to say
 * what the target is and what "understanding it" means — not run any analysis
 * from the renderer. There is nothing to open: the conversation is the surface.
 */
export function createInvestigateActions(ctx: PluginContext): PluginFileExplorerContextMenuContribution[] {
	const start = async (path: string, isDirectory: boolean) => {
		const prompt = ctx.i18n.t("action.investigate.prompt", {
			path,
			kind: ctx.i18n.t(isDirectory ? "action.investigate.directory" : "action.investigate.file"),
		});
		try {
			try {
				await ctx.conversation.sendPrompt(prompt);
			} catch {
				// No active conversation: open one next to the target and retry once.
				const directory = isDirectory ? path : path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
				await ctx.conversation.createSession(directory || ".");
				await ctx.conversation.sendPrompt(prompt);
			}
		} catch (error) {
			reportError(ctx.i18n.t("action.investigate.failed"), error);
		}
	};

	return [
		{
			id: "investigate-with-rea",
			label: "%action.investigate%",
			order: 90,
			when: { resourceType: "file", extensions: FILE_TARGET_EXTENSIONS },
			run: ({ entry }) => start(entry.path, false),
		},
		{
			id: "investigate-with-rea-directory",
			label: "%action.investigate%",
			order: 90,
			when: { resourceType: "directory", extensions: DIRECTORY_TARGET_EXTENSIONS },
			run: ({ entry }) => start(entry.path, true),
		},
	];
}
