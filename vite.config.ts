import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { runLlmAnalysis } from "./src/llm.ts";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function roundtableApi(): Plugin {
  return {
    name: "roundtable-api",
    configureServer(server) {
      server.middlewares.use("/api/analyze", (req, res) => {
        if (req.method !== "POST") {
          send(res, 405, { error: "Use POST." });
          return;
        }
        void (async () => {
          try {
            const raw = await readBody(req);
            const analysis = await runLlmAnalysis(raw ? JSON.parse(raw) : {});
            send(res, 200, { analysis });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Ranking failed.";
            send(res, /Provider returned/.test(message) ? 502 : 400, { error: message });
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), roundtableApi()],
  server: { host: true, port: 5173 },
});
