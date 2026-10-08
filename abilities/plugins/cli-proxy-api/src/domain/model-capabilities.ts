import { z } from "zod";

const modality = z.enum(["text", "image", "audio", "video", "file"]);
const modalities = z.array(modality).min(1);
const nativeSchema = z.object({ web_search: z.boolean().optional() });
const hostInput = z.array(z.enum(["text", "image"])).min(1);

export type UpstreamModelCapabilities = {
  inputModalities?: z.infer<typeof modalities>;
  nativeWebSearch?: boolean;
};

export function readHostInput(model: { input?: unknown }): { input?: ("text" | "image")[] } {
  const parsed = hostInput.safeParse(model.input);
  return parsed.success ? { input: [...new Set(parsed.data)] } : {};
}

/** Advertise only declared modalities; never guess from a model's name. */
export function readModelCapabilities(entry: Record<string, unknown>): UpstreamModelCapabilities & { input?: ("text" | "image")[] } {
  const parsed = modalities.safeParse(entry.supported_input_modalities ?? entry.supportedInputModalities ?? entry.input_modalities);
  const native = nativeSchema.safeParse(entry.native_capabilities);
  const inputModalities = parsed.success ? [...new Set(parsed.data)] : undefined;
  const input = inputModalities?.filter((value): value is "text" | "image" => value === "text" || value === "image");
  return {
    ...(inputModalities ? { inputModalities } : {}),
    ...(input?.length ? { input } : {}),
    ...(native.success && native.data.web_search !== undefined ? { nativeWebSearch: native.data.web_search } : {}),
  };
}
