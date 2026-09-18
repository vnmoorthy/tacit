# Tacit API

Base path: `/api`. JSON in, JSON out. Errors: `{ "error": "message" }` with 400 (validation, includes `issues`), 404, 409 (feature not configured) or 500.

## Health

`GET /health` → `{ ok, version, engine: { brain, model, embeddings, voice }, provider, notes[], higgs, phone }`

## Captures

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/captures` | — | `Capture[]` |
| POST | `/captures` | `{ expert: { name, role, team?, tenureYears?, departureDate? }, successor?: { name, role? }, context, title? }` | `Capture` (with planned `domains`) |
| GET | `/captures/:id` | — | `Capture` |
| PATCH | `/captures/:id` | partial capture, `status`, `voiceId` | `Capture` |
| DELETE | `/captures/:id` | — | `{ ok }` |
| GET | `/captures/:id/export` | — | `{ capture, sessions, turns, atoms, questions }` |
| GET | `/captures/:id/handover` | — | `{ markdown }` |
| GET | `/captures/:id/instructions` | — | `{ instructions }` — system prompt for a speech-to-speech interviewer |

## Sessions & turns

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/captures/:id/sessions` | — | `Session[]` |
| POST | `/captures/:id/sessions` | `{ mode: "voice-higgs" \| "voice-browser" \| "text" }` | `{ session, interviewerTurn, capture }` |
| GET | `/sessions/:id` | — | `{ session, turns, atoms, capture }` |
| POST | `/sessions/:id/turns` | `{ text, generateNext?: boolean }` | `{ expertTurn, atoms, interviewerTurn, capture }` |
| POST | `/sessions/:id/interviewer` | `{ text, kind?, domainId? }` | `Turn` — log what a speech-to-speech model said |
| POST | `/sessions/:id/end` | — | `Session` with `summary` |

`generateNext: false` is used by speech-to-speech engines (Higgs, phone) that produce their own next question: the API only extracts atoms.

## Atoms

| Method | Path | Query / body | Returns |
|---|---|---|---|
| GET | `/captures/:id/atoms` | `q`, `type`, `domainId`, `verified` | `Atom[]` (ranked by hybrid retrieval when `q` is set) |
| PATCH | `/atoms/:id` | `{ title?, content?, type?, tags?, verified?, domainId? }` | `Atom` |
| DELETE | `/atoms/:id` | — | `{ ok }` |

## The twin

`POST /captures/:id/ask` `{ question, askedBy? }` →

```json
{
  "question": "…", "answer": "markdown with [1] citations",
  "confidence": "high | medium | low | none",
  "citations": [{ "n": 1, "atomId": "atom_…", "title": "…", "type": "procedure", "quote": "…", "sessionId": "…", "turnId": "…", "score": 0.91 }],
  "queuedQuestion": { "id": "q_…", "text": "…", "status": "open" },
  "engine": "nebius/Qwen/Qwen3-30B-A3B-Instruct-2507"
}
```

## Questions

| Method | Path | Body |
|---|---|---|
| GET | `/captures/:id/questions` | — |
| POST | `/captures/:id/questions` | `{ text, source?, askedBy?, domainId? }` |
| PATCH | `/questions/:id` | `{ text?, status?, domainId? }` |

## Samples

`GET /samples` · `POST /samples/load` `{ key? }` → loads Maria (payroll) and Dev (SRE).

## Voice

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/voice/higgs/session` | `{ captureId }` | `{ clientSecret, expiresAt, wsUrl, model, voice, instructions, transcriptionModel }` |
| POST | `/voice/tts` | `{ text, voice?, captureId? }` | `audio/mpeg` (uses the capture's cloned voice when present) |
| POST | `/captures/:id/voice/clone` | multipart `audio` (≥3 s, ≤10 MB) + `transcript` | `{ voiceId, capture }` |

## Phone

`POST /phone/call` `{ captureId, phone }` (E.164) → `{ session, roomName, opening }`. Requires `LIVEKIT_*` env; see PHONE.md.
