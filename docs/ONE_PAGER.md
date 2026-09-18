# Tacit

**Institutional memory, captured by conversation.**

**Problem.** When an experienced employee leaves, the unwritten runbook goes too: real deadlines, equipment quirks, judgment calls and the person who can unblock a crisis. Asking experts to document everything adds another task to an already busy handover.

**Product.** Tacit is an open-source voice AI that interviews departing experts and turns their answers into a searchable knowledge base their successor can talk to. It serves offboarding and succession in teams such as payroll, engineering and plant operations.

**How it works.** Tacit plans interview topics from the expert's role and responsibilities, then asks focused questions and follow-ups. During the interview, it extracts editable knowledge atoms—procedures, rules, contacts and other details—with source quotes, while tracking coverage. The successor asks a knowledge twin for cited answers, reviews the captured material, and compiles a handover document.

**The closed loop.** When the twin cannot answer confidently, it queues the question for the expert's next interview. Successor questions take priority, so everyday gaps shape the next conversation.

**Partner technology.** Boson AI's **Higgs Realtime** powers speech-to-speech interviews with interruptions and natural turn-taking. **Higgs Audio** reads answers aloud and supports cloning the expert's voice with permission. **Nebius Token Factory** provides inference for interviewing and extraction, plus embeddings for retrieval. Browser voice, typed answers and an offline demo engine let teams try the workflow without API keys; the same core engine runs in a browser or on a server.

**Business model—proposed.** Start with HR offboarding: one capture per departing expert, with per-seat pricing for organizations, as outlined in the [demo pitch](DEMO.md). The current project is MIT-licensed open source; paid packaging and pricing remain to be validated.

**Explore:** [Live demo](https://vnmoorthy.github.io/tacit/) · [Source and setup](https://github.com/vnmoorthy/tacit) · [Product walkthrough](https://github.com/vnmoorthy/tacit/releases/download/v0.1.0-hackathon/tacit-demo.mp4) · [Architecture](ARCHITECTURE.md)
