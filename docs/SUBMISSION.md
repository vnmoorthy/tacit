# Hackathon submission — copy-paste kit

Form: https://forms.gle/c5BFUZTttRN7NHT79 (Boson Higgs Audio Hackathon 2026). Also the OSS4AI "Build an AI Startup in One Day" judging.

**Project name:** Tacit

**One-line description:** A voice AI that interviews departing experts and turns what's in their head into a living, cited knowledge base their successor can talk to.

**Tracks:** Voice at Work (primary) · Agents That Act · Breaking the Language Barrier

**Team:** Moorthy (GitHub: vnmoorthy)

**Public repo:** https://github.com/vnmoorthy/tacit — tagged release: https://github.com/vnmoorthy/tacit/releases/tag/v0.1.0-hackathon · commit `3add3f7df79652e79f89358edae416a66eac3fcb`

**Live demo (optional):** https://vnmoorthy.github.io/tacit/ (standalone mode: offline brain + browser voice; the Higgs voice path runs on the local server with a Boson key)

**Demo video (2–3 min, public link):** https://github.com/vnmoorthy/tacit/releases/download/v0.1.0-hackathon/tacit-demo.mp4 (release asset; also in the repo at docs/assets/tacit-demo.mp4; replace with a YouTube link if you upload one)

## Write-up

**Problem.** About 10,000 Americans turn 65 every day. When a 19-year payroll lead or a staff SRE leaves, the runbook they never wrote leaves with them: the real cut-off time, the vendor rep who actually answers, the macro on their desktop. Fortune 500s lose an estimated $31.5B a year to poor knowledge sharing, and 42% of what a job needs is known only by the person doing it. The fix has always been "write the documentation". Experts don't. But they will talk for an hour.

**What Tacit does.** Tacit makes the talking the documentation. A voice agent interviews the expert one question at a time, follows the thread ("you said *usually*, when isn't that the case?"), and probes for failure modes, cut-offs and who-to-call. While the expert is still talking, every answer becomes typed, cited knowledge atoms (procedure, rule, gotcha, contact, tool, decision, glossary, risk, story) and a coverage map fills in live, steering the interviewer to what's still missing. The successor then talks to the expert's *twin*: grounded answers with citations back to the expert's own words, spoken in their cloned voice. Anything the twin can't answer is queued and becomes the first question of the next interview. That closed loop is the product. A 3D "Constellation" of the knowledge can be explored with hand gestures through the camera and asked questions by voice.

**How we use Higgs Audio.**
- **Higgs Realtime** runs the interview itself: speech-to-speech in the browser with an ephemeral client secret, semantic turn detection and barge-in, `higgs-stt-3.1` transcripts flowing into extraction, and the interviewer's agenda refreshed with `session.update` after every answer.
- **Higgs Audio TTS** speaks the twin's answers.
- **Voice cloning** (`/v1/audio/voices`) clones the expert from a clip recorded during the interview, so the successor hears answers the way the expert would say them.
- **Multilingual interviews**: the expert is interviewed in their own language (Higgs' 100+ languages) while the knowledge base is written in English.
- A phone path (Twilio SIP → LiveKit → Higgs Realtime agent) is implemented and documented.

**Tech.** TypeScript monorepo: one isomorphic engine (planner, interviewer, extractor, coverage, hybrid retrieval, handover compiler, two interchangeable brains) that runs on a Hono + SQLite server or fully in the browser; React 19 + Vite + Tailwind v4 frontend; Nebius Token Factory (Qwen3-30B-A3B + Qwen3-Embedding-8B) for the LLM, with OpenAI, Anthropic, local Ollama and an offline demo brain as alternatives; three.js + MediaPipe for the Constellation; Docker, CI, GitHub Pages. 19 tests. MIT.

**What's next.** Inbound phone line and scheduled call-backs; Confluence/Notion/SharePoint export; multi-expert knowledge graphs; SSO and audit; an evaluation harness for extraction quality across models.

## Setup instructions (for the form)

```bash
git clone https://github.com/vnmoorthy/tacit.git && cd tacit
pnpm install
cp .env.example .env   # add BOSON_API_KEY and NEBIUS_API_KEY for the full experience (works with none)
pnpm dev               # http://localhost:5173 — click "Load sample captures"
```
