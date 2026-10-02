// src/prompt.ts
var SHARED_PROMPT = `Review all my Claude, Codex, and Grok Bot conversations you can access, along with my local workflows and memories.

Identify what I can optimize, what you could fully automate, and where you could handle part of the work.

Rank the opportunities by likely time saved and effort to set up, and explain what access or input you would need from me.`;

// src/types.ts
var SOURCES = ["claude", "codex", "grok", "workflow", "memory"];
var EFFORT_WEIGHT = {
  low: 1,
  medium: 2.2,
  high: 4
};
var EFFORT_SETUP_HOURS = {
  low: 1.5,
  medium: 4,
  high: 8
};

// src/score.ts
function round1(value) {
  return Math.round(value * 10) / 10;
}
function round2(value) {
  return Math.round(value * 100) / 100;
}
function returnScore(hours, confidence, effort) {
  return round2(hours * confidence * 10 / EFFORT_WEIGHT[effort]);
}
function headlineFor(hours, count, transcript) {
  if (transcript.trim().length < 40) {
    return "Paste a conversation, a workflow, or a memory. A few sentences is enough to rank.";
  }
  if (count === 0) {
    return "Nothing repeating stood out. Add who does the work, how often, and how long it takes.";
  }
  const label = hours.toFixed(1).replace(/\.0$/, "");
  const noun = count === 1 ? "move" : "moves";
  return `${label} hours a week look recoverable across ${count} ranked ${noun}.`;
}
function finalize(drafts, engine, model, guardrails, memories, transcript) {
  const opportunities = drafts.map((draft) => ({
    ...draft,
    effortHours: EFFORT_SETUP_HOURS[draft.effort],
    score: returnScore(draft.timeSavedHoursPerWeek, draft.confidence, draft.effort),
    rank: 0
  })).sort((a, b) => b.score - a.score || b.timeSavedHoursPerWeek - a.timeSavedHoursPerWeek).map((opportunity, index) => ({ ...opportunity, rank: index + 1 }));
  const hoursPerWeek = round1(
    opportunities.reduce((sum, opportunity) => sum + opportunity.timeSavedHoursPerWeek, 0)
  );
  const setupHours = round1(
    opportunities.reduce((sum, opportunity) => sum + opportunity.effortHours, 0)
  );
  return {
    engine,
    model,
    headline: headlineFor(hoursPerWeek, opportunities.length, transcript),
    hoursPerWeek,
    setupHours,
    guardrails,
    memories,
    opportunities
  };
}
var MODES = /* @__PURE__ */ new Set(["optimize", "automate", "handoff"]);
var EFFORTS = /* @__PURE__ */ new Set(["low", "medium", "high"]);
function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
function analysisFromModel(payload, model) {
  if (!payload || typeof payload !== "object") {
    throw new Error("The model did not return a JSON object.");
  }
  const record = payload;
  const rows = Array.isArray(record.opportunities) ? record.opportunities : null;
  if (!rows || rows.length === 0) {
    throw new Error("The model returned no opportunities.");
  }
  const drafts = [];
  for (const row of rows.slice(0, 8)) {
    if (!row || typeof row !== "object") continue;
    const item = row;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (title.length < 3) continue;
    const mode = MODES.has(item.mode) ? item.mode : "handoff";
    const effort = EFFORTS.has(item.effort) ? item.effort : "medium";
    const sources = Array.isArray(item.sources) ? item.sources.filter(
      (source) => SOURCES.includes(source)
    ) : [];
    const needs = Array.isArray(item.needs) ? item.needs.filter((need) => typeof need === "string" && need.trim().length > 0).map((need) => need.trim()).slice(0, 6) : [];
    drafts.push({
      id: `llm-${drafts.length + 1}`,
      title: title.slice(0, 140),
      mode,
      summary: typeof item.summary === "string" && item.summary.trim() ? item.summary.trim().slice(0, 600) : "The model flagged this as repeating work.",
      timeSavedHoursPerWeek: round1(clamp(Number(item.timeSavedHoursPerWeek), 0.1, 40)),
      effort,
      confidence: round2(clamp(Number(item.confidence), 0.05, 0.98)),
      sources: sources.length > 0 ? [...new Set(sources)] : ["workflow"],
      needs: needs.length > 0 ? needs : ["Tell me where this should start and what done looks like"],
      evidence: typeof item.evidence === "string" ? item.evidence.trim().slice(0, 320) : ""
    });
  }
  if (drafts.length === 0) {
    throw new Error("The model response had no usable opportunities.");
  }
  const memories = Array.isArray(record.memories) ? record.memories.filter((line) => typeof line === "string").slice(0, 8) : [];
  const guardrails = Array.isArray(record.guardrails) ? record.guardrails.filter((line) => typeof line === "string").slice(0, 6) : [];
  return finalize(drafts, "llm", model, guardrails, memories, "model-ranked transcript");
}

// src/llm.ts
var ALLOWED_HOSTS = /* @__PURE__ */ new Set([
  "api.openai.com",
  "api.x.ai",
  "api.groq.com",
  "openrouter.ai",
  "api.mistral.ai"
]);
function parseLlmRequest(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Missing JSON body.");
  }
  const record = body;
  const transcript = typeof record.transcript === "string" ? record.transcript.trim() : "";
  const apiKey = typeof record.apiKey === "string" ? record.apiKey.trim() : "";
  const baseUrl = typeof record.baseUrl === "string" ? record.baseUrl.trim() : "";
  const model = typeof record.model === "string" ? record.model.trim() : "";
  if (transcript.length < 40) {
    throw new Error("Paste a little more of the conversation so the ranking has something to read.");
  }
  if (transcript.length > 6e4) {
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
function chatCompletionsUrl(baseUrl) {
  let url;
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
      "Use api.x.ai, api.openai.com, api.groq.com, openrouter.ai, or api.mistral.ai."
    );
  }
  const path = url.pathname.replace(/\/$/, "");
  const endpoint = path.endsWith("/chat/completions") ? path : `${path}/chat/completions`;
  return `${url.origin}${endpoint}`;
}
function stripKey(text, apiKey) {
  return apiKey ? text.split(apiKey).join("[key]") : text;
}
function formatProviderError(status, raw, apiKey) {
  const clean = stripKey(raw, apiKey).trim();
  try {
    const parsed = JSON.parse(clean);
    const message = typeof parsed.error === "string" ? parsed.error : parsed.error?.message || parsed.message;
    if (message) return `Provider returned ${status}. ${message}`;
  } catch {
  }
  return `Provider returned ${status}. ${clean.slice(0, 180)}`;
}
function messageText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object" && "text" in part) {
      return String(part.text ?? "");
    }
    return "";
  }).join("");
}
function extractJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The model did not return JSON.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}
var SYSTEM = `You are Roundtable, a workflow analyst. Follow this instruction from the person whose work you are reading:

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
async function complete(url, request, jsonMode) {
  const body = {
    model: request.model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Transcript, workflows, and memories:

${request.transcript}`
      }
    ]
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(28e3)
  });
  const raw = await response.text();
  if (response.status === 400 && jsonMode && /response_format|json_object|response format/i.test(raw)) {
    return complete(url, request, false);
  }
  if (!response.ok) {
    throw new Error(formatProviderError(response.status, raw, request.apiKey));
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Provider returned a non-JSON response.");
  }
  const content = parsed && typeof parsed === "object" && "choices" in parsed && Array.isArray(parsed.choices) ? parsed.choices[0]?.message?.content : void 0;
  const text = messageText(content);
  if (!text) throw new Error("Provider returned an empty completion.");
  return text;
}
async function runLlmAnalysis(body) {
  const request = parseLlmRequest(body);
  const url = chatCompletionsUrl(request.baseUrl);
  const text = await complete(url, request, true);
  return analysisFromModel(extractJson(text), request.model);
}

// server/analyze.ts
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  try {
    const analysis = await runLlmAnalysis(req.body);
    res.status(200).json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ranking failed.";
    const status = /Provider returned/.test(message) ? 502 : 400;
    res.status(status).json({ error: message });
  }
}
export {
  handler as default
};
