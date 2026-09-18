# Tacit — 3-minute pitch storyboard (10 slides)

Total: 3:00. Timings are targets; the live demo on slides 4–5 is the part to protect. If you're running long, drop slide 7.

| # | Time | Slide | What you say | What the audience sees / you do |
|---|---|---|---|---|
| 1 | 0:00–0:12 | **Title** | "Hi, I'm [name]. This is Tacit. Institutional memory, captured by conversation." | Dark title slide with the amber orb. Pause one beat on the tagline. |
| 2 | 0:12–0:40 | **The problem** | "Every day, ten thousand Americans turn sixty-five. When a 19-year payroll lead or a staff SRE leaves, the runbook they never wrote leaves with them: the real cut-off time, the vendor rep who actually answers, the macro on their desktop. Fortune 500s lose thirty-one billion dollars a year to this, and 42% of what a job needs is known only by the person doing it. The fix has always been 'write the docs'. Experts don't. But they will talk for an hour." | Three big stats. Let the last line land: *"they will talk for an hour."* |
| 3 | 0:40–1:00 | **The insight** | "So Tacit makes the talking the documentation. A voice agent interviews the expert, one question at a time, and follows the thread the way a good journalist would. Every answer becomes typed, cited knowledge atoms. The successor asks the expert's twin. And anything the twin can't answer goes straight back into the next interview. That loop is the product." | Four-step loop diagram. Trace the arrow back from *Gaps* to *Interview* with your hand. |
| 4 | 1:00–1:45 | **Live demo: interview** | "Let me show you. Maria runs payroll for 1,400 people and leaves in 42 days." Switch to the app: open Maria's capture, click *Continue interviewing*, pick **Higgs Realtime**, *Begin session*. Answer the question in one breath, e.g. the garnishment rule. "Watch the right side." Interrupt Tacit once mid-sentence to show barge-in. *End session.* | Live app, not the slide. Atoms pop in on the right; coverage bars move. Say: "Boson's Higgs Realtime runs the conversation, Nebius runs the extraction, and every sentence became a typed atom while I was still talking." |
| 5 | 1:45–2:15 | **Live demo: the twin** | Open *Ask the twin*, toggle speaker on. Ask: "The ACH file bounced on a Friday afternoon, what do I do?" Let the cloned voice answer. Then ask something Maria never covered. "It doesn't guess. It queues the question, and that becomes the first thing Tacit asks her next time." | Answer with [1][2][4] citations in Maria's cloned voice; then the *Queued for Maria* badge. |
| 6 | 2:15–2:30 | **How it works** | "Under the hood: one engine that runs on the server or entirely in the browser, any model provider, Higgs for voice, and a Twilio-plus-LiveKit path so Tacit can simply call the expert's phone. Zero native dependencies, open source, MIT." | Architecture slide. Don't read it; point at the four layers. |
| 7 | 2:30–2:40 | **Why now** | "Speech-to-speech is finally fast and cheap enough to feel like a colleague, open models structure speech reliably for cents a turn, and Peak 65 — four million retirements a year — is happening right now." | Three columns. Optional if short on time. |
| 8 | 2:40–2:50 | **Business** | "The wedge is HR offboarding: one capture per departing expert, fifteen hundred dollars each, or an enterprise platform at sixty thousand a year. Buyers are CHROs and COOs in banking, utilities, manufacturing and the public sector; channels are HRIS marketplaces and the Big Four's knowledge-transfer practices." | Pricing + buyer + channel in three lines. |
| 9 | 2:50–2:56 | **Market** | "Knowledge management is a thirty-billion-dollar category, and every departure is a purchase trigger with a hard deadline." | Nested TAM/SAM/SOM. One sentence only. |
| 10 | 2:56–3:00 | **The ask** | "It's live at vnmoorthy.github.io/tacit and on GitHub. We want three design partners facing a retirement wave. Come talk to Maria's twin at our table. Thank you." | URLs on screen. Stop talking. |

## Rehearsal notes

- Open the app *before* you walk up: `pnpm dev`, samples loaded, mic permission already granted in Chrome, "Hear the twin" tested once so the audio path is warm.
- Say the garnishment answer slowly; the atoms are the applause line, give them two seconds.
- If Higgs is slow on venue Wi‑Fi, switch to **Browser voice** at the pre-flight screen; if the mic dies, **Type answers**. Nothing else changes.
- If a judge asks "why not just record meetings?": recordings aren't queryable, aren't structured, and don't know what they're missing. Tacit knows the coverage gap and steers the conversation.
- If asked about privacy: keys never reach the browser, atoms are editable and verifiable by the expert, voice cloning is opt-in per session.
