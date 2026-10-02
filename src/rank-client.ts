import type { Analysis } from "./types.ts";

export async function rankWithModel(input: {
  transcript: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<Analysis> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  let payload: { analysis?: Analysis; error?: string } = {};
  try {
    payload = (await response.json()) as { analysis?: Analysis; error?: string };
  } catch {
    throw new Error("The ranking service returned an unreadable response.");
  }
  if (!response.ok || !payload.analysis) {
    throw new Error(payload.error || "The model ranking failed.");
  }
  return payload.analysis;
}
