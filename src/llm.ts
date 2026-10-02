import { SHARED_PROMPT } from "./prompt.ts";
import { analysisFromModel } from "./score.ts";
import type { Analysis } from "./types.ts";

const ALLOWED_HOSTS = new Set([
  "api.openai.com",
  "api.x.ai",
  "api.groq.com",
  "openrouter.ai",
  "api.mistral.ai",
]);

export type LlmRequest = {
  transcript: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function parseLlmRequest(body: unknown): LlmRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Missing JSON body.");
  }
  const record = body as Record<string, unknown>;
  const transcript = typeof record.transcript === "string" ? record.transcript.trim() : "";
  const apiKey = typeof record.apiKey === "string" ? record.apiKey.trim() : "";
  const baseUrl = typeof record.baseUrl === "string" ? record.baseUrl.trim() : "";
  const model = typeof record.model === "string" ? record.model.trim() : "";

  if (transcript.length < 40) {
    throw new Error("Paste a little more of the conversation so the ranking has something to read.");
  }
  if (transcript.length > 60_000) {
    throw new Error("Transcript is too long. Keep it under 60,000 characters.");
  }
  if (!apiKey || apiKey.length > 400 || /[\r\n]/.test(apiKey)) {
    throw new Error("Add a provider API key.");
  }
  if (!model || model.length > 100 || !/^[\w./:-]+$/.test(model)) {
    throw new Error("Add a model name using letters, numbers, and . _ / : -");
  }
  chatCompletionsUrl(baseUrl);
  return { transcript, apiKey, baseUrl, model };
}

export function chatCompletionsUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Provider URL is not valid.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Provider URL must use https.");
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(
      "Use api.x.ai, api.openai.com, api.groq.com, openrouter.ai, or api.mistral.ai.",
    );
  }
  const path = url.pathname.replace(/\/$/, "");
  const endpoint = path.endsWith("/chat/completions") ? path : `${path}/chat/completions`;
  return `${url.origin}${endpoint}`;
}

function stripKey(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join("[key]") : text;
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The model did not return JSON.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

const SYSTEM = `You are Roundtable, a workflow analyst. Follow this instruction from the person whose work you are reading:

${SHARED_PROMPT}

Return only JSON with this shape:
{
  "guardrails": ["constraints such as never auto-publish"],
  "memories": ["stable preferences worth keeping"],
  "opportunities": [
    {
      "title": "short imperative",
      "mode": "optimize | automate | handoff",
      "summary": "what changes for them",
      "timeSavedHoursPerWeek": 1.5,
      "effort": "low | medium | high",
      "confidence": 0.8,
      "sources": ["claude" | "codex" | "grok" | "workflow" | "memory"],
      "needs": ["access or input required"],
      "evidence": "short quote from the transcript"
    }
  ]
}

Rules:
- optimize = fewer steps, the person still does the work
- automate = an agent can run it end to end, including internal files and summaries
- handoff = an agent prepares the work and a person approves it
- If they review sends, or a memory says never auto-publish, publishing and client email must be handoff
- Estimate hours per week from stated duration and frequency. Do not invent a huge number
- 3 to 6 opportunities, concrete, no tools they did not imply
- needs must say what access or input you still need from them`;

async function complete(
  url: string,
  request: LlmRequest,
  jsonMode: boolean,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: request.model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Transcript, workflows, and memories:\n\n${request.transcript}`,
      },
    ],
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(28_000),
  });

  const raw = await response.text();
  if (response.status === 400 && jsonMode) {
    return complete(url, request, false);
  }
  if (!response.ok) {
    const detail = stripKey(raw, request.apiKey).slice(0, 280);
    throw new Error(`Provider returned ${response.status}. ${detail}`.trim());
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Provider returned a non-JSON response.");
  }
  const content =
    parsed &&
    typeof parsed === "object" &&
    "choices" in parsed &&
    Array.isArray((parsed as { choices: unknown }).choices)
      ? (parsed as { choices: { message?: { content?: unknown } }[] }).choices[0]?.message
          ?.content
      : undefined;
  const text = messageText(content);
  if (!text) throw new Error("Provider returned an empty completion.");
  return text;
}

export async function runLlmAnalysis(body: unknown): Promise<Analysis> {
  const request = parseLlmRequest(body);
  const url = chatCompletionsUrl(request.baseUrl);
  const text = await complete(url, request, true);
  return analysisFromModel(extractJson(text), request.model);
}
