import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chatCompletionsUrl, extractJson, formatProviderError, parseLlmRequest } from "./llm.ts";

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

describe("formatProviderError", () => {
  it("uses the provider message and hides the key", () => {
    const message = formatProviderError(
      400,
      JSON.stringify({ error: "Incorrect API key sk-secret provided." }),
      "sk-secret",
    );
    assert.equal(message, "Provider returned 400. Incorrect API key [key] provided.");
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
