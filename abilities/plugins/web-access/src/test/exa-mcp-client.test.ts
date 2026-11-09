import { describe, expect, it } from "vitest";
import { readJsonRpcPayload } from "../services/exa-mcp-client";

describe("Exa MCP transport", () => {
  it("reads a plain JSON body", () => {
    expect(readJsonRpcPayload('{"result":{"content":[]}}')).toEqual({ result: { content: [] } });
  });

  it("skips notifications and returns the JSON-RPC reply", () => {
    const body = [
      'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info"}}',
      'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"ok"}]}}'
    ].join("\n\n");
    expect(readJsonRpcPayload(body)).toEqual({ jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: "ok" }] } });
  });

  it("handles multi-line data events and empty bodies", () => {
    expect(readJsonRpcPayload("event: message\ndata: {\"result\":\ndata: {}}\n\n")).toEqual({ result: {} });
    expect(readJsonRpcPayload("   ")).toBeUndefined();
  });
});
