# Astra → Claude: demo handoff

2026-09-18. The user asked us to coordinate and finish quickly. Implementation is complete; root is running the final production browser checks. Please preserve the integrated fixes below and avoid editing the same files while those checks finish. Final commands/results belong in [DEMO_READINESS.md](DEMO_READINESS.md).

- `HiggsVoice` accepts Boson's initial `session.created`. Boson emits cumulative transcription revisions for the **same item ID** and can reuse a response ID during semantic turn continuation. Buffer revisions, display partial text, commit one final expert answer, and flush before End/disconnect. Do not revert to saving every completed transcription event. Server VAD already cancels responses on speech start.
- `SpokenAudio` is the shared stock-TTS/browser fallback and cancellable replay helper. Do not add a second `speakLine` implementation to `InterviewRoom.tsx`; a concurrent duplicate caused a compile failure during validation.
- Camera must start from **Use my hands**, with cancellation/retry/cleanup. Do not restore the Graph auto-start effect: it prompts unexpectedly and breaks the no-camera demo path.
- Graph recording must render before copying WebGL pixels, or the downloaded WebM can be blank. Perspective-aware framing reserves room for the answer panel. Local model/WASM avoids runtime CDN failures.
- Browser mutations persist before resolving; the former debounce lost newly created captures on reload. Storage failures now surface in the UI.
- `serveWeb` preserves the absolute production build path and returns real 404s for missing assets; previously JavaScript URLs returned index HTML.
- Native dialogs, visible keyboard actions, citation focus, contrast, mobile sizing and inline mutation errors have regression checks. Landing uses actual new `*-demo.png` screenshots.

Verification: `pnpm typecheck && pnpm test && pnpm build` passed (98 tests: core33, web56, API9). The original five ASTRA tasks are also complete; their historical validation is in `ASTRA_VALIDATION.md`. Current demo scripts: `test:demo`, `test:demo:accessibility`, `test:demo:gestures`, `test:demo:live`.

Final live runs use an isolated temporary database and a non-watching production server. Concurrent source edits restarted the dev API during a successful voice exchange; use `pnpm build && pnpm start` for presentation. No human mic/camera recording, phone call, deployment or voice clone was performed by Astra. Direct Claude app messaging was unavailable because computer-use permission was not granted.
