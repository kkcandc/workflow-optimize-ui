export const SOURCES = ["claude", "codex", "grok", "workflow", "memory"] as const;

export type Source = (typeof SOURCES)[number];

export type Mode = "optimize" | "automate" | "handoff";

export type Effort = "low" | "medium" | "high";

export type Engine = "offline" | "llm";

export type Opportunity = {
  id: string;
  rank: number;
  title: string;
  mode: Mode;
  summary: string;
  timeSavedHoursPerWeek: number;
  effort: Effort;
  effortHours: number;
  confidence: number;
  sources: Source[];
  needs: string[];
  evidence: string;
  score: number;
};

export type Analysis = {
  engine: Engine;
  model?: string;
  headline: string;
  hoursPerWeek: number;
  setupHours: number;
  guardrails: string[];
  memories: string[];
  opportunities: Opportunity[];
};

export const SOURCE_LABEL: Record<Source, string> = {
  claude: "Claude",
  codex: "Codex",
  grok: "Grok Bot",
  workflow: "Workflow",
  memory: "Memory",
};

export const MODE_LABEL: Record<Mode, string> = {
  optimize: "Optimize",
  automate: "Automate",
  handoff: "Hand off",
};

export const EFFORT_LABEL: Record<Effort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const EFFORT_WEIGHT: Record<Effort, number> = {
  low: 1,
  medium: 2.2,
  high: 4,
};

export const EFFORT_SETUP_HOURS: Record<Effort, number> = {
  low: 1.5,
  medium: 4,
  high: 8,
};

export const EFFORT_HINT: Record<Effort, string> = {
  low: "About 1.5 hours to set up",
  medium: "About half a day to set up",
  high: "A dedicated setup day",
};
