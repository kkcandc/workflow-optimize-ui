export type Credentials = {
  apiKey: string;
  baseUrl: string;
  model: string;
  preset: string;
};

export const PRESETS = [
  {
    id: "xai",
    label: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
  },
] as const;

const STORAGE_KEY = "roundtable.credentials.v1";

export function defaultCredentials(): Credentials {
  return {
    apiKey: "",
    baseUrl: PRESETS[0].baseUrl,
    model: PRESETS[0].model,
    preset: PRESETS[0].id,
  };
}

export function loadCredentials(): Credentials {
  const fallback = defaultCredentials();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Credentials>;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : fallback.baseUrl,
      model: typeof parsed.model === "string" ? parsed.model : fallback.model,
      preset: typeof parsed.preset === "string" ? parsed.preset : "custom",
    };
  } catch {
    return fallback;
  }
}

export function saveCredentials(credentials: Credentials): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    /* private mode and blocked storage still work for the current view */
  }
}

export function clearCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
