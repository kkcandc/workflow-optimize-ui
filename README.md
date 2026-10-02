# Roundtable

A desk for the [Roundtable meta-prompt](https://x.com/RoundtableSpace/status/2105994958515921384). Paste conversations, local workflows, and memories. Roundtable ranks what to optimize, what an agent can run, and what it should only prepare for you.

The ranking follows likely time saved and the effort to set up, and every card says what access or input is still needed.

```
Review all my Claude, Codex, and Grok Bot conversations you can access, along with my local workflows and memories.

Identify what I can optimize, what you could fully automate, and where you could handle part of the work.

Rank the opportunities by likely time saved and effort to set up, and explain what access or input you would need from me.
```

This app does not sign in to Claude, Codex, or Grok. You paste what you can already access. A sample desk is built in so the ranking works with nothing connected.

Owner: Kenny Kline, personal account. The GitHub repo stays `kkcandc/workflow-optimize-ui`.

## Run it

```bash
npm install
npm test
npm run dev
```

Open the local URL Vite prints. Load **Sample desk**, or paste a transcript, then **Rank the opportunities**. Ctrl+Enter or Cmd+Enter ranks from the text box.

`npm run build` typechecks the app and the API route, then writes `dist/`.

## Offline scoring

The default engine never calls a network. It reads durations (“90 minutes”, “3.5 hours”) and cadence (“every Monday”, “three times a week”, “twice a month”), then matches repeating work such as newsletters, ad exports, competitor briefs, and checklists.

Return score:

```
weekly hours × confidence ÷ setup weight
```

Setup weights are low `1`, medium `2.2`, and high `4`. Sort by **Return**, **Hours**, or **Easiest setup**. Hours on separate cards can overlap. If a memory says you review sends, or the note says “never auto-publish”, publishing work stays a handoff.

## Optional model key

Switch the header to **Model** and save a key. The browser posts the transcript and key to `/api/analyze` on this app. That route calls an OpenAI-compatible chat endpoint and then applies the same ranking math.

Allowed hosts:

- `api.x.ai`
- `api.openai.com`
- `api.groq.com`
- `openrouter.ai`
- `api.mistral.ai`

The key stays in this browser’s `localStorage` after you save it. The server does not store it. If the provider fails, the page shows the offline ranking and the error.

Presets include xAI Grok, OpenAI, Groq, and OpenRouter. Change the model name if your account uses a different id.

## Deploy

The Vercel project belongs to Kenny Kline’s personal account (hobby team “Kenny Kline's projects”), and the GitHub repo stays `kkcandc/workflow-optimize-ui`. Framework is Vite. The model route is bundled from `server/analyze.ts` into `api/analyze.js` during the build. Static files come from `dist/`.

Production: https://workflow-optimize-ui.vercel.app
