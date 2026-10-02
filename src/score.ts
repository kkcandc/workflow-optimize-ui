import type {
  Analysis,
  Effort,
  Mode,
  Opportunity,
  Source,
} from "./types.ts";
import {
  EFFORT_SETUP_HOURS,
  EFFORT_WEIGHT,
  SOURCES,
} from "./types.ts";

type Block = {
  source: Source;
  title: string;
  text: string;
};

type Detector = {
  id: string;
  pattern: RegExp;
  mode: Mode;
  effort: Effort;
  confidence: number;
  fallbackHours: number;
  hourSource: "context" | "fallback";
  title: string;
  summary: string;
  needs: string[];
};

const DETECTORS: Detector[] = [
  {
    id: "newsletter",
    pattern: /beehiiv|newsletter/i,
    mode: "automate",
    effort: "medium",
    confidence: 0.9,
    fallbackHours: 2,
    hourSource: "context",
    title: "Prepare the Thursday newsletter pack for review",
    summary:
      "The Thursday pack is the same shape every week: Beehiiv draft, subject lines, and a LinkedIn post from the call notes. An agent can assemble it. You still approve the send.",
    needs: [
      "The Calls folder, or the week's notes pasted in",
      "Two or three past issues so the voice stays yours",
      "Where the draft should land, Beehiiv or a doc",
      "A yes from you before anything sends",
    ],
  },
  {
    id: "ads",
    pattern: /google ads|meta ads/i,
    mode: "automate",
    effort: "medium",
    confidence: 0.92,
    fallbackHours: 1.5,
    hourSource: "context",
    title: "Run the Monday ads rollup on its own",
    summary:
      "The Monday export and Slack recap is the same job every week. Pin the destination sheet and let the rollup file itself instead of rebuilding it by hand.",
    needs: [
      "A weekly CSV drop, or read-only access to Google Ads and Meta",
      "The sheet the team already trusts",
      "The Slack channel for the summary",
      "One example of a column rename the export must survive",
    ],
  },
  {
    id: "script",
    pattern: /rewrite this python script|column names change/i,
    mode: "optimize",
    effort: "low",
    confidence: 0.76,
    fallbackHours: 0.8,
    hourSource: "fallback",
    title: "Stop rewriting the ads export script",
    summary:
      "Codex has rebuilt the same Python export four times because columns move. Save one fixer in the repo so the next rename is a patch, not a new conversation. This is the rewrite loop, separate from the Monday export itself.",
    needs: [
      "The current script, in the repo",
      "A sample of the old column names and the new ones",
      "Permission to keep the fixer as a local workflow",
    ],
  },
  {
    id: "competitor",
    pattern: /competitor/i,
    mode: "automate",
    effort: "low",
    confidence: 0.84,
    fallbackHours: 1,
    hourSource: "context",
    title: "File the competitor delta brief",
    summary:
      "Three scans a week already follow a template: sources, five bullets, and what changed. Store the last brief and write the next one against it. Keep it in a doc. Do not send it.",
    needs: [
      "The competitor list to watch",
      "Where the last brief lives, so the delta is real",
      "Permission to read public sources",
    ],
  },
  {
    id: "checklist",
    pattern: /launch checklist|utm links/i,
    mode: "handoff",
    effort: "medium",
    confidence: 0.8,
    fallbackHours: 1,
    hourSource: "context",
    title: "Draft the campaign launch checklist",
    summary:
      "UTM links, creative sizes, and the client approval email get rebuilt for every campaign. An agent can prepare the packet. You send the approval.",
    needs: [
      "The UTM rules you already use",
      "The creative folder and the sizes you export",
      "Who approves, and the email to draft rather than send",
    ],
  },
  {
    id: "inbox",
    pattern: /inbox|unread email|triage my email/i,
    mode: "handoff",
    effort: "medium",
    confidence: 0.7,
    fallbackHours: 1.5,
    hourSource: "context",
    title: "Triage the inbox into a short list",
    summary:
      "The inbox pass is a repeating sort: what needs you, what is waiting, what can be filed. An agent can propose the piles. You decide what actually gets a reply.",
    needs: [
      "A label or folder it is allowed to read",
      "What 'needs me today' means in your words",
      "Confirmation that it drafts replies and does not send them",
    ],
  },
  {
    id: "meetings",
    pattern: /meeting notes|action items/i,
    mode: "handoff",
    effort: "low",
    confidence: 0.74,
    fallbackHours: 1,
    hourSource: "context",
    title: "Turn meeting notes into owners and dates",
    summary:
      "Notes already contain the decisions. The slow part is pulling owners and dates into the tracker. An agent can draft that list for a quick pass.",
    needs: [
      "Where notes land after a call",
      "The tracker or doc that should receive the actions",
      "The names you use for owners",
    ],
  },
];

const SIGNAL_RULES: { pattern: RegExp; weight: number; mode: Mode }[] = [
  { pattern: /every morning|every day|each morning|daily/i, weight: 3, mode: "automate" },
  { pattern: /every week|weekly|each week/i, weight: 2, mode: "automate" },
  { pattern: /manually|by hand|copy|paste|export/i, weight: 2, mode: "automate" },
  { pattern: /draft|write|summar/i, weight: 2, mode: "handoff" },
  { pattern: /rename|refactor|rewrite|clean up/i, weight: 2, mode: "optimize" },
];

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function returnScore(hours: number, confidence: number, effort: Effort): number {
  return round2((hours * confidence * 10) / EFFORT_WEIGHT[effort]);
}

function frequency(text: string): number {
  const rules: [RegExp, number][] = [
    [/three times a week|3 times a week|3x a week/i, 3],
    [/twice a week|two times a week|2 times a week/i, 2],
    [/twice a month|two times a month|2 times a month/i, 2 / 4.3],
    [/once a month|every month|monthly/i, 1 / 4.3],
    [/every day|each day|daily|every morning|each morning/i, 5],
    [
      /every week|each week|weekly|most weeks|every monday|every tuesday|every wednesday|every thursday|every friday/i,
      1,
    ],
  ];
  for (const [pattern, value] of rules) {
    if (pattern.test(text)) return value;
  }
  return 1;
}

export function extractWeeklyHours(text: string, fallback: number): number {
  const hour = /(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)\b/i.exec(text);
  const minute = /(\d+(?:\.\d+)?)\s*(?:minutes|minute|mins|min)\b/i.exec(text);
  if (!hour && !minute) return round1(fallback);
  let duration = fallback;
  if (hour && minute) {
    duration = hour.index <= minute.index ? Number(hour[1]) : Number(minute[1]) / 60;
  } else if (hour) {
    duration = Number(hour[1]);
  } else if (minute) {
    duration = Number(minute[1]) / 60;
  }
  return round1(duration * frequency(text));
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length > 0);
}

function contextFor(text: string, pattern: RegExp): string {
  const list = sentences(text);
  const index = list.findIndex((sentence) => pattern.test(sentence));
  if (index < 0) return text.slice(0, 420);
  return [list[index - 1], list[index], list[index + 1]].filter(Boolean).join(" ");
}

function evidenceFor(text: string, pattern: RegExp): string {
  const list = sentences(text);
  return list.find((sentence) => pattern.test(sentence)) ?? text.slice(0, 220);
}

const DURATION =
  /(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|minutes|minute|mins|min)\b/i;

function hoursFor(detector: Detector, text: string, context: string): number {
  if (detector.hourSource === "fallback") return detector.fallbackHours;
  const window = DURATION.test(context) ? context : text;
  return extractWeeklyHours(window, detector.fallbackHours);
}

export function detectSources(transcript: string): Source[] {
  const found = new Set<Source>();
  const marked = /source:\s*(claude|codex|grok|workflow|memory)/gi;
  for (const match of transcript.matchAll(marked)) {
    found.add(match[1].toLowerCase() as Source);
  }
  if (/\bclaude\b/i.test(transcript)) found.add("claude");
  if (/\bcodex\b/i.test(transcript)) found.add("codex");
  if (/\bgrok\b/i.test(transcript)) found.add("grok");
  if (/\bworkflows?\b|\bchecklist\b/i.test(transcript)) found.add("workflow");
  if (/\bmemories\b|\bmemory\b|\bremember\b/i.test(transcript)) found.add("memory");
  return SOURCES.filter((source) => found.has(source));
}

function inferSource(text: string): Source {
  const ranked = detectSources(text).filter((source) => source !== "memory");
  return ranked[0] ?? "workflow";
}

function parseBlocks(transcript: string): Block[] {
  const pattern =
    /---\s*source:\s*(claude|codex|grok|workflow|memory)\s*(?:\|\s*title:\s*([^\n]*))?\s*---\n?([\s\S]*?)(?=(?:---\s*source:)|\s*$)/gi;
  const blocks: Block[] = [];
  for (const match of transcript.matchAll(pattern)) {
    const text = match[3].trim();
    if (!text) continue;
    blocks.push({
      source: match[1].toLowerCase() as Source,
      title: (match[2] ?? "").trim(),
      text,
    });
  }
  if (blocks.length > 0) return blocks;
  const text = transcript.trim();
  if (!text) return [];
  return [{ source: inferSource(text), title: "Pasted notes", text }];
}

function collectMemories(blocks: Block[], transcript: string): string[] {
  const lines = new Set<string>();
  const sources = blocks.filter((block) => block.source === "memory");
  const pools = sources.length > 0 ? sources.map((block) => block.text) : [transcript];
  for (const pool of pools) {
    for (const raw of pool.split("\n")) {
      const line = raw.replace(/^memory:\s*/i, "").trim();
      if (!line) continue;
      if (sources.length > 0 || /^memory:/i.test(raw) || /\bremember\b/i.test(raw)) {
        lines.add(line.replace(/\s+/g, " "));
      }
    }
  }
  return [...lines].slice(0, 8);
}

const GUARDRAIL =
  /never auto-publish|reviews every|review the copy|review myself|before it sends|before anything sends|do not auto/i;

function pushGuardrail(guard: string[], line: string): void {
  const clean = line.replace(/^memory:\s*/i, "").replace(/\s+/g, " ").trim();
  if (!clean || !GUARDRAIL.test(clean)) return;
  const key = clean.toLowerCase();
  const existing = guard.findIndex((item) => {
    const other = item.toLowerCase();
    return other === key || other.includes(key) || key.includes(other);
  });
  if (existing === -1) {
    guard.push(clean);
    return;
  }
  if (clean.length > guard[existing].length) guard[existing] = clean;
}

function collectGuardrails(memories: string[], blocks: Block[]): string[] {
  const guard: string[] = [];
  for (const memory of memories) pushGuardrail(guard, memory);
  for (const block of blocks) {
    if (block.source === "memory") continue;
    for (const sentence of sentences(block.text)) pushGuardrail(guard, sentence);
  }
  return guard.slice(0, 4);
}

export function resolveMode(mode: Mode, text: string, guardrails: string[]): Mode {
  const publishing =
    /newsletter|beehiiv|linkedin|subject line|approval email|auto-publish|tweet/i.test(text);
  const held =
    /review the copy|review myself|reviews every|never auto-publish|before it sends|before anything sends/i.test(
      `${text}\n${guardrails.join("\n")}`,
    );
  if (mode === "automate" && publishing && held) return "handoff";
  return mode;
}

function headlineFor(hours: number, count: number, transcript: string): string {
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

function finalize(
  drafts: Omit<Opportunity, "rank" | "score" | "effortHours">[],
  engine: Analysis["engine"],
  model: string | undefined,
  guardrails: string[],
  memories: string[],
  transcript: string,
): Analysis {
  const opportunities = drafts
    .map((draft) => ({
      ...draft,
      effortHours: EFFORT_SETUP_HOURS[draft.effort],
      score: returnScore(draft.timeSavedHoursPerWeek, draft.confidence, draft.effort),
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || b.timeSavedHoursPerWeek - a.timeSavedHoursPerWeek)
    .map((opportunity, index) => ({ ...opportunity, rank: index + 1 }));

  const hoursPerWeek = round1(
    opportunities.reduce((sum, opportunity) => sum + opportunity.timeSavedHoursPerWeek, 0),
  );
  const setupHours = round1(
    opportunities.reduce((sum, opportunity) => sum + opportunity.effortHours, 0),
  );

  return {
    engine,
    model,
    headline: headlineFor(hoursPerWeek, opportunities.length, transcript),
    hoursPerWeek,
    setupHours,
    guardrails,
    memories,
    opportunities,
  };
}

function genericOpportunities(blocks: Block[]): Omit<Opportunity, "rank" | "score" | "effortHours">[] {
  const seen = new Set<string>();
  const found: Omit<Opportunity, "rank" | "score" | "effortHours">[] = [];
  for (const block of blocks) {
    if (block.source === "memory") continue;
    for (const sentence of sentences(block.text)) {
      if (sentence.length < 40) continue;
      let weight = 0;
      const modeWeight: Record<Mode, number> = { automate: 0, handoff: 0, optimize: 0 };
      for (const rule of SIGNAL_RULES) {
        if (rule.pattern.test(sentence)) {
          weight += rule.weight;
          modeWeight[rule.mode] += rule.weight;
        }
      }
      if (weight < 2) continue;
      const mode = (Object.entries(modeWeight) as [Mode, number][]).sort((a, b) => b[1] - a[1])[0][0];
      const key = sentence.slice(0, 80).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const hours = extractWeeklyHours(sentence, 1);
      found.push({
        id: `signal-${found.length + 1}-${block.source}`,
        title: sentence.length > 88 ? `${sentence.slice(0, 85).replace(/\s+\S*$/, "")}…` : sentence,
        mode,
        summary:
          "This reads as repeating work. The offline pass estimated the hours from the words on the page. A model key will rewrite the title once you want a sharper brief.",
        timeSavedHoursPerWeek: hours,
        effort: "medium",
        confidence: /(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|minutes|minute|mins|min)\b/i.test(sentence)
          ? 0.55
          : 0.4,
        sources: [block.source],
        needs: [
          "One finished example of the output you want",
          "The source you copy from, and where the result should land",
        ],
        evidence: sentence,
      });
    }
  }
  return found.slice(0, 3);
}

export function scoreTranscript(transcript: string): Analysis {
  const blocks = parseBlocks(transcript);
  const memories = collectMemories(blocks, transcript);
  const guardrails = collectGuardrails(memories, blocks);
  const drafts: Omit<Opportunity, "rank" | "score" | "effortHours">[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    if (block.source === "memory") continue;
    for (const detector of DETECTORS) {
      if (!detector.pattern.test(block.text)) continue;
      const id = `${detector.id}-${block.source}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const context = contextFor(block.text, detector.pattern);
      const hours = hoursFor(detector, block.text, context);
      const blob = `${detector.title} ${detector.summary} ${context}`;
      const mode = resolveMode(detector.mode, blob, guardrails);
      const demoted = mode !== detector.mode;
      drafts.push({
        id,
        title: detector.title,
        mode,
        summary: demoted
          ? `${detector.summary} Kept as a handoff because you review sends yourself.`
          : detector.summary,
        timeSavedHoursPerWeek: hours,
        effort: detector.effort,
        confidence: detector.confidence,
        sources: [block.source],
        needs: demoted
          ? [...detector.needs, "Your review before anything goes out"]
          : detector.needs,
        evidence: evidenceFor(block.text, detector.pattern),
      });
    }
  }

  const usable = drafts.length > 0 ? drafts : genericOpportunities(blocks);
  return finalize(usable, "offline", undefined, guardrails, memories, transcript);
}

const MODES = new Set<Mode>(["optimize", "automate", "handoff"]);
const EFFORTS = new Set<Effort>(["low", "medium", "high"]);

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function analysisFromModel(payload: unknown, model: string): Analysis {
  if (!payload || typeof payload !== "object") {
    throw new Error("The model did not return a JSON object.");
  }
  const record = payload as Record<string, unknown>;
  const rows = Array.isArray(record.opportunities) ? record.opportunities : null;
  if (!rows || rows.length === 0) {
    throw new Error("The model returned no opportunities.");
  }

  const drafts: Omit<Opportunity, "rank" | "score" | "effortHours">[] = [];
  for (const row of rows.slice(0, 8)) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (title.length < 3) continue;
    const mode = MODES.has(item.mode as Mode) ? (item.mode as Mode) : "handoff";
    const effort = EFFORTS.has(item.effort as Effort) ? (item.effort as Effort) : "medium";
    const sources = Array.isArray(item.sources)
      ? item.sources.filter((source): source is Source =>
          SOURCES.includes(source as Source),
        )
      : [];
    const needs = Array.isArray(item.needs)
      ? item.needs
          .filter((need): need is string => typeof need === "string" && need.trim().length > 0)
          .map((need) => need.trim())
          .slice(0, 6)
      : [];
    drafts.push({
      id: `llm-${drafts.length + 1}`,
      title: title.slice(0, 140),
      mode,
      summary:
        typeof item.summary === "string" && item.summary.trim()
          ? item.summary.trim().slice(0, 600)
          : "The model flagged this as repeating work.",
      timeSavedHoursPerWeek: round1(clamp(Number(item.timeSavedHoursPerWeek), 0.1, 40)),
      effort,
      confidence: round2(clamp(Number(item.confidence), 0.05, 0.98)),
      sources: sources.length > 0 ? [...new Set(sources)] : ["workflow"],
      needs:
        needs.length > 0
          ? needs
          : ["Tell me where this should start and what done looks like"],
      evidence: typeof item.evidence === "string" ? item.evidence.trim().slice(0, 320) : "",
    });
  }

  if (drafts.length === 0) {
    throw new Error("The model response had no usable opportunities.");
  }

  const memories = Array.isArray(record.memories)
    ? record.memories.filter((line): line is string => typeof line === "string").slice(0, 8)
    : [];
  const guardrails = Array.isArray(record.guardrails)
    ? record.guardrails.filter((line): line is string => typeof line === "string").slice(0, 6)
    : [];

  return finalize(drafts, "llm", model, guardrails, memories, "model-ranked transcript");
}
