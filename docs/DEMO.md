# Tacit — 3-minute demo script

**Setup before the client arrives:** run `pnpm build`, then `pnpm start` with `NEBIUS_API_KEY` + `BOSON_API_KEY`. Open Chrome at http://localhost:8787, load the three samples, and rehearse one spoken answer and the hand controls on the presentation laptop. Use a headset to reduce speaker echo. A production build keeps source edits from interrupting the presentation. See [DEMO_READINESS.md](DEMO_READINESS.md) for repeatable checks.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Dashboard | "Every day 10,000 Americans retire. Each one takes 20 years of know-how nobody wrote down. Companies lose $31 billion a year to this. The fix has always been *write the docs*. Experts don't. But they'll talk for an hour. Tacit makes the talking the documentation." |
| 0:25 | Maria's overview | "Maria runs payroll for 1,400 people and leaves in 42 days. Tacit planned a coverage map of what her successor Jordan needs, and after two interviews it's 49% covered with 29 knowledge atoms, each cited to her own words." |
| 0:45 | Interview room → Higgs Realtime → Begin | Answer one question live, e.g. about garnishments. Point at atoms appearing on the right and the coverage bars moving. "Boson's Higgs Realtime handles the conversation; Nebius runs the extraction; every sentence becomes a typed atom while I'm still talking." Interrupt Tacit once to show barge-in. End session. |
| 1:45 | Ask the twin (spoken answers on) | Ask: "The ACH file bounced on a Friday afternoon, what do I do?" → spoken answer with citations. The sample uses a stock voice unless a consenting expert's clone has been configured. Open a citation to show its exact source quote. Ask "Who owns forklift certification renewals?" to demonstrate a gap; begin the next interview to show that question first. |
| 2:25 | Handover doc | "One click, a handover document, compiled from the knowledge we captured." Download the Markdown file. Mention phone interviews only if LiveKit and Twilio have been configured and rehearsed. |
| 2:40 | Close | "HR offboarding is the wedge: one capture per departing expert, priced per seat. Retirement waves in banking, utilities, manufacturing and the public sector are the market. It's open source, it runs on any model, and it works with zero keys. Tacit: institutional memory, captured by conversation." |

**Optional constellation moment:** open Maria's Constellation, ask the ACH question, and show the cited nodes beside the answer. Click **Use my hands** to grant camera permission. Point to inspect, pinch a node to pick it up, open a palm to orbit, and move two hands apart to zoom. Release before changing gestures. Mouse and keyboard controls remain available. **Step inside** uses the live camera as the backdrop; **Record** exports the scene to WebM.

**If voice fails:** choose **Use text** to continue the same saved interview, or **Retry voice** after restoring microphone permission/network access. Spoken answer playback does not require microphone permission. Browser speech availability depends on the browser and operating system.

**If the server/network is unavailable:** use standalone mode and load its own sample captures. Server and standalone data are separate; switching mode does not copy the live interview into the browser. The offline brain uses deterministic extraction and retrieval, so describe it as a fallback demo rather than the live model.
