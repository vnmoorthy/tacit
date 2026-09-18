# Architecture

![Architecture](assets/architecture.png)

## Principles

1. **One engine, many hosts.** `packages/core` has no Node or DOM dependencies. The API wraps it with SQLite; the browser wraps it with localStorage. Tests wrap it with `MemoryStore`. Adding a host means implementing the 20-method `Store` interface.
2. **Never block the demo.** Provider resolution is ordered (Nebius → OpenAI → Anthropic → Ollama → demo brain) and every LLM call has a heuristic fallback. A dead API key degrades quality, never availability.
3. **Voice is a transport, not the brain.** Higgs Realtime, browser speech, and the phone agent all produce the same two events, *expert said X* and *interviewer said Y*, and post them to the same endpoints. Extraction, coverage and the question queue are engine concerns.
4. **Atoms are the unit.** Every fact the expert states becomes a typed, cited, editable record. Documents (handover) and answers (twin) are views over atoms, regenerated on demand.

## Data model

```
Capture ─┬─ Domain[]   (coverage map: priority, targetQuestions, askedCount, atomCount, coverage)
         ├─ Session[]  (mode, timing, summary)
         │    └─ Turn[] (interviewer|expert, kind, domainId, questionId, extractedAtomIds)
         ├─ Atom[]     (type, title, content, tags, confidence, verified, sourceQuote, turnId, domainId)
         ├─ Question[] (source: plan|successor|gap|followup, status: open|asked|answered)
         └─ embeddings (atomId → vector)
```

## Interview loop

```
startSession ──▶ planNext(isOpening) ──▶ interviewer turn (opening / successor question)
      ▲                                              │
      │                                              ▼  expert answers (voice / text)
      │             ┌─────────── Promise.all ──────────┐
      │             │ extract(answer) → atoms          │  planNext(transcript) → next question
      │             └───────────────────────────────────┘
      │                     refresh coverage · close answered successor questions
      └────────────────────────── repeat until endSession → summary
```

Speech-to-speech engines (Higgs Realtime, phone agent) skip `planNext`: the model asks its own questions from `interviewerInstructions()`, which embeds the coverage map and the successor's queued questions and is refreshed after every answer via `session.update`.

## Retrieval

```
query ─▶ BM25(title+content+tags+quote) ─┐
                                         ├─ RRF ─▶ top-k atoms ─▶ brain.answer ─▶ confidence gate ─▶ queue?
query ─▶ embed ─▶ cosine over vectors ───┘  (only when an embedder is configured)
```

`strength = max(bm25/3.2, (cos−0.35)/0.4)` clipped to [0,1] drives the heuristic brain's confidence; the LLM brain reports its own.

## Security notes

- Boson keys never reach the browser: the API mints 30-minute ephemeral client secrets.
- Standalone mode stores user-entered provider keys in `localStorage` only and calls providers directly.
- No auth layer yet (hackathon scope). Put the API behind your SSO proxy; see the roadmap.
