# Contributing to Tacit

Thanks for helping preserve institutional memory. Tacit is a pnpm monorepo:

| Path | What |
|---|---|
| `packages/core` | The engine: types, brains (LLM + offline heuristic), retrieval, coverage, handover compiler, samples. Isomorphic — runs on the server and in the browser. |
| `apps/api` | Hono + SQLite (`node:sqlite`) REST API, provider auto-detection, Boson Higgs ephemeral keys. |
| `apps/web` | Vite + React 19 + Tailwind v4 frontend, two voice engines, standalone mode. |

## Setup

```bash
pnpm install
cp .env.example .env   # optional — everything works with no keys
pnpm dev               # API on :8787, web on :5173
pnpm seed              # load the two sample captures into SQLite
```

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Adding a provider

Implement `LLM` (and optionally `Embedder`) in `packages/core/src/llm.ts`, then wire detection in `apps/api/src/providers.ts`. Anything OpenAI-compatible already works via `OpenAICompatibleLLM`.

## Adding a role template

Templates in `packages/core/src/templates.ts` drive the offline planner. Add keywords, 5–8 domains, and 2–3 open questions per domain.

## Pull requests

- Keep PRs focused; add or update a test in `packages/core/src/__tests__` or `apps/api/src/__tests__`.
- Run the checks above before opening a PR.
- Be kind. Experts trusting us with 20 years of know-how deserve careful code.

## Testing the voice path without a microphone

```bash
# Protocol check: stream a 24 kHz mono PCM16 WAV into Higgs Realtime and print the events
BOSON_API_KEY=... node scripts/higgs-probe.mjs clip.wav
```

For a full browser run, launch Chromium with a fake mic that plays a clip (leave 2–3 s of silence at the end so turn detection can fire):

```bash
npx playwright open --browser chromium \
  --args="--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-audio-capture=clip.wav" \
  http://localhost:5173
```
