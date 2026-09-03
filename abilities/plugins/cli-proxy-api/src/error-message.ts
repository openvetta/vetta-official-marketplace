const MAX_DISPLAY_ERROR_LENGTH = 240;

export function toDisplayErrorMessage(reason: unknown): string {
  let message = reason instanceof Error ? reason.message : String(reason);
  const capabilityMarker = "CapabilityError:";
  const capabilityIndex = message.lastIndexOf(capabilityMarker);
  if (capabilityIndex >= 0) message = message.slice(capabilityIndex + capabilityMarker.length);
  message = message
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^(?:Error|PluginNetworkError):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!message) return "Operation failed";
  if (message.length <= MAX_DISPLAY_ERROR_LENGTH) return message;
  return `${message.slice(0, MAX_DISPLAY_ERROR_LENGTH - 1).trimEnd()}…`;
}

