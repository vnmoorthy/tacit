import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Engine } from "@tacit/core";
import { env, loadEnv } from "./env.js";
import { resolveProviders } from "./providers.js";
import { buildRoutes } from "./routes.js";
import { SqliteStore } from "./sqlite.js";
import { serveWeb } from "./web.js";

loadEnv();

const VERSION = "0.1.0";
// API_PORT wins; PORT is honoured only in production (PaaS convention) so dev tooling that injects PORT for the web server can't collide.
const PORT = Number(env("API_PORT") || (process.env.NODE_ENV === "production" ? env("PORT") : "") || "8787");
const DB_PATH = env("DATABASE_PATH", resolve(process.cwd(), "data/tacit.db"));
const WEB_DIST = env("WEB_DIST", resolve(process.cwd(), "../web/dist"));

export async function createApp() {
  const providers = await resolveProviders();
  const store = new SqliteStore(DB_PATH);
  const engine = new Engine({
    store,
    brain: providers.brain,
    embedder: providers.embedder,
    voice: { higgs: Boolean(env("BOSON_API_KEY")), browser: true },
  });

  const app = new Hono();
  app.use("*", logger((s) => process.env.NODE_ENV !== "test" && console.log(s)));
  app.use("/api/*", cors());
  app.route("/api", buildRoutes(engine, { version: VERSION, notes: providers.notes, provider: providers.provider }));

  // Production: serve the built web app with SPA fallback.
  if (!serveWeb(app, WEB_DIST)) {
    app.get("/", (c) => c.text(`Tacit API ${VERSION} — web build not found. Run \`pnpm build\` or use the Vite dev server.`));
  }
  return { app, engine, providers };
}

const isMain = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  createApp().then(({ app, providers }) => {
    serve({ fetch: app.fetch, port: PORT }, (info) => {
      console.log(`\n  Tacit API  →  http://localhost:${info.port}`);
      console.log(`  brain: ${providers.provider}${providers.embedder ? ` · embeddings: ${providers.embedder.name}/${providers.embedder.model}` : ""}`);
      console.log(`  voice: ${env("BOSON_API_KEY") ? "Higgs Realtime + browser" : "browser (set BOSON_API_KEY for Higgs Realtime)"}`);
      for (const n of providers.notes) console.log(`  note: ${n}`);
      console.log();
    });
  });
}
