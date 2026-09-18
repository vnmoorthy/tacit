import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Load .env from the repo root and the api dir (no dependency; Node ≥ 21). */
export function loadEnv() {
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env"), resolve(process.cwd(), "../.env")];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      (process as any).loadEnvFile?.(p);
    } catch {
      /* ignore */
    }
  }
}

export const env = (k: string, fallback = ""): string => (process.env[k] ?? fallback).trim();
