import type { PluginStorageApi } from "@vetta-org/plugin-sdk";
import { z } from "zod";

/**
 * Remembers what the user already did with a rendered view (submitted a form, clicked a
 * quick reply), keyed by tool call. Without it a reopened conversation would show the form
 * as fresh and invite a duplicate submission.
 */

const recordSchema = z.object({
    kind: z.enum(["form", "action"]),
    at: z.number(),
    values: z.record(z.string(), z.unknown()).optional(),
    choice: z.string().optional(),
});
const fileSchema = z.record(z.string(), recordSchema);

export type InteractionRecord = z.infer<typeof recordSchema>;
export type InteractionRecords = Record<string, InteractionRecord>;

type Storage = Pick<PluginStorageApi, "readFile" | "writeFile">;

const fileFor = (toolCallId: string) => `interactions/${toolCallId.replace(/[^\w.-]/gu, "_").slice(0, 120)}.json`;

export class InteractionStore {
    constructor(private readonly storage: Storage) {}

    async load(toolCallId: string): Promise<InteractionRecords> {
        const raw = await this.storage.readFile(fileFor(toolCallId), "utf8");
        if (!raw) return {};
        const parsed = fileSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : {};
    }

    async save(toolCallId: string, blockPath: string, record: InteractionRecord): Promise<InteractionRecords> {
        const next = { ...(await this.load(toolCallId)), [blockPath]: record };
        await this.storage.writeFile(fileFor(toolCallId), JSON.stringify(next), "utf8");
        return next;
    }
}
