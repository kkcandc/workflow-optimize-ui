import type { Source } from "./types.ts";

export type SampleSection = {
  id: string;
  source: Source;
  title: string;
  body: string;
};

export const SAMPLE_SECTIONS: SampleSection[] = [
  {
    id: "newsletter",
    source: "claude",
    title: "Thursday newsletter",
    body: "I spend about 3.5 hours every Thursday turning the week's call notes into a Beehiiv newsletter, three subject lines, and a LinkedIn post. I ask you to do this most weeks. I always review the copy myself before it sends. Keep the voice direct, with no hype.",
  },
  {
    id: "ads",
    source: "codex",
    title: "Monday ads export",
    body: "Every Monday I lose about 90 minutes exporting Google Ads and Meta Ads into the same sheet, then writing a Slack summary for the team. I have asked you to rewrite this Python script four times because the column names change. I want the rollup to run without me babysitting it.",
  },
  {
    id: "competitors",
    source: "grok",
    title: "Competitor delta",
    body: "Three times a week I spend 40 minutes asking for a competitor launch scan and a five-bullet brief. I always want the sources, and I want what changed since the last brief. File it for me. Do not email anyone.",
  },
  {
    id: "launch",
    source: "workflow",
    title: "Launch checklist",
    body: "Local workflow: campaign launch checklist. For every campaign I manually build UTM links, export the creative sizes, and draft an approval email to the client. It takes about 2 hours and I do it twice a month.",
  },
  {
    id: "notes",
    source: "memory",
    title: "Standing notes",
    body: "Memory: Kenny reviews every consumer send himself. Never auto-publish.\nMemory: Rank recommendations by hours returned and how hard they are to set up.\nMemory: Brand voice is plain, specific, and free of hype.\nMemory: Call notes live in a folder named Calls. Weekly ad exports land in Drive/Ads Weekly.",
  },
];

export function sectionTranscript(section: SampleSection): string {
  return `--- source: ${section.source} | title: ${section.title} ---\n${section.body}`;
}

export function sampleTranscript(sections: SampleSection[] = SAMPLE_SECTIONS): string {
  return sections.map(sectionTranscript).join("\n\n");
}
