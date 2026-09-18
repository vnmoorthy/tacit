import { resolve } from "node:path";
import { Engine, HeuristicBrain, buildAllSamples } from "@tacit/core";
import { env, loadEnv } from "./env.js";
import { SqliteStore } from "./sqlite.js";

loadEnv();
const store = new SqliteStore(env("DATABASE_PATH", resolve(process.cwd(), "data/tacit.db")));
const engine = new Engine({ store, brain: new HeuristicBrain() });
for (const bundle of buildAllSamples()) {
  const c = await engine.importBundle(bundle);
  console.log(`seeded ${c.title}: ${c.stats.atoms} atoms, ${c.stats.sessions} sessions, ${Math.round(c.stats.coverage * 100)}% coverage`);
}
