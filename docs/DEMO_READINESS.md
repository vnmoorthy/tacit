# Demo readiness — 18 September 2026

The integrated product is implemented and all final production checks pass. The live voice journey passed with a generated microphone fixture, real Higgs/Nebius providers, one saved expert answer, two extracted atoms and a completed session. A clean production preview runs at http://localhost:8794 with the three original fictional samples; automated test interviews use a separate database.

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm test` | 98 passed: core 33, web 56, API 9 |
| `pnpm build` | Passed |
| Offline browser journey | 9 checks passed; no page errors |
| Accessibility and recovery | 9 checks passed; no page errors |
| Production live voice | Passed: real speech, transcription, extraction, persistence and session completion |
| Production gesture/export repeat | 7 passed: real inference, nonblank recording, camera stop/cancel/denial/retry/navigation cleanup and local assets |

The offline journey loads all three fictional samples, creates a capture, extracts knowledge from an interview, reloads saved data, edits with the keyboard, answers with citations, returns an unanswered question to the next interview, compiles the handover, renders Constellation and checks the mobile dashboard. The accessibility suite additionally exercises forward/backward modal focus, Escape and focus restoration, destructive-action cancellation, failed-save retry, clipboard-denied recovery, citation focus, and 390 px layouts. Amber badge contrast measured **7.41:1**.

Voice and gesture evidence has a precise boundary. Real provider calls returned cited model answers and decodable stock Higgs TTS. The production voice repeat confirmed that cumulative provider transcript revisions save as one expert answer, produce knowledge atoms, and end cleanly without runtime/protocol errors. The gesture workflow exercises the actual bundled MediaPipe model against a prerecorded two-hand fixture, plus camera denial/cancellation/cleanup and a decodable graph recording. This is not a rehearsal with the presenter's microphone, camera, room acoustics or physical gestures. The accessibility suite uses simulated synthesis to test playback cancellation without microphone access. Voice cloning and phone calls were not tested.

Run the application from a production build for presentation; concurrent source edits restarted the development server during validation:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

Repeat the browser checks against the running application:

```sh
DEMO_URL=http://localhost:8787 pnpm test:demo
DEMO_URL=http://localhost:8787 pnpm test:demo:accessibility
DEMO_URL=http://localhost:8787 DEMO_HAND_FIXTURE=/tmp/woman_hands.jpg pnpm test:demo:gestures
```

The gesture script requires the separately downloaded official fixture and ffmpeg; its header documents the source. `pnpm test:demo:live` requires `DEMO_LIVE_TEST=1`, `DEMO_URL` and `DEMO_API_URL` pointing to an **isolated seeded test database** with configured providers. It creates a test interview and makes provider requests. Browser suites use Playwright; reports and screenshots go to `DEMO_ARTIFACTS` when supplied.

Evidence is in `/tmp/tacit-demo-smoke/results.json`, `/tmp/tacit-demo-accessibility/results.json`, `/tmp/tacit-demo-live/results.json` and `/tmp/tacit-demo-gestures/results.json`; all four final reports pass with no runtime errors. Run WebGL browser suites serially on laptops: the initial parallel production pass hit action timeouts under software rendering. Landing screenshots in `apps/web/public/img/*-demo.png` are captures of the running application using fictional samples.

Current preview process uses `DATABASE_PATH=/tmp/tacit-client-demo-20260918.db`, `WEB_DIST=/tmp/tacit-demo-production-20260918` and `API_PORT=8794`. These temporary paths hold the validated snapshot. For ongoing use, rebuild and start normally as above. The existing Vite mixed static/dynamic-import warning and Node SQLite experimental warning remain non-failing.

Claude coordination and fixes that must be preserved are documented in [ASTRA_HANDOFF.md](ASTRA_HANDOFF.md). No deployment was performed.
