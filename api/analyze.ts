import { runLlmAnalysis } from "../src/llm.ts";

type NodeRequest = {
  method?: string;
  body?: unknown;
};

type NodeResponse = {
  status: (code: number) => NodeResponse;
  json: (body: unknown) => void;
};

export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
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
