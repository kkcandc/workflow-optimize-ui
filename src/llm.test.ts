import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chatCompletionsUrl, extractJson, parseLlmRequest } from "./llm.ts";

describe("chatCompletionsUrl", () => {
  it("builds an OpenAI-compatible endpoint", () => {
    assert.equal(
      chatCompletionsUrl("https://api.x.ai/v1"),
      "https://api.x.ai/v1/chat/completions",
    );
    assert.equal(
      chatCompletionsUrl("https://api.openai.com/v1/chat/completions"),
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("refuses hosts that are not on the provider list", () => {
    assert.throws(() => chatCompletionsUrl("https://example.com/v1"), /api\.x\.ai/);
    assert.throws(() => chatCompletionsUrl("http://api.openai.com/v1"), /https/);
  });
});

describe("extractJson", () => {
  it("reads fenced JSON", () => {
    const parsed = extractJson('```json\n{"opportunities":[]}\n```');
    assert.deepEqual(parsed, { opportunities: [] });
  });
});

describe("parseLlmRequest", () => {
  it("rejects a short transcript before any provider call", () => {
    assert.throws(
      () =>
        parseLlmRequest({
          transcript: "too short",
          apiKey: "sk-test",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
        }),
      /a little more/i,
    );
  });
});
