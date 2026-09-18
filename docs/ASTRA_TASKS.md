# Tasks for a collaborating AI (Astra) — Tacit

You are helping polish **Tacit**, an open-source voice AI that interviews departing experts and turns what they say into a cited knowledge base. Read `README.md` and `docs/ARCHITECTURE.md` first. Work in small, verifiable pull requests. **Do not** change the visual design system (colors, fonts, layout), the API contract, or the data model; those are frozen for the hackathon demo.

Before you finish any task, run all three and paste the output in your PR description:

```bash
pnpm typecheck && pnpm test && pnpm build
```

Only these directories are open to you: `packages/core/src/templates.ts`, `packages/core/src/samples.ts`, `packages/core/src/__tests__/`, `docs/`, and new files under `apps/web/public/`. Ask before touching anything else.

---

## Task 1 — Add five industry role templates (highest value)

File: `packages/core/src/templates.ts`. Each template drives the offline planner (what Tacit asks when no LLM is configured) and seeds the LLM planner's expectations.

Add templates for: **clinical nursing**, **field service / utilities lineworker**, **restaurant / hospitality GM**, **public-sector caseworker**, **research lab manager**.

For each: 6–8 domains, each with `name`, one-sentence `description`, `priority` (1 critical, 2 important, 3 nice-to-have), and 2–3 `questions` that are open, concrete, and sound natural when read aloud ("Walk me through…", "When does that not work…", "Who actually gets it unstuck…"). Keep the shared `COMMON_TAIL` at the end, like the existing templates. Add 8–14 `keywords` per template so `pickTemplate()` selects it from the role + context text.

Acceptance: `pnpm --filter @tacit/core test` passes; add one test per template in `packages/core/src/__tests__/brain.test.ts` asserting `pickTemplate("<a plausible role>", "<a plausible context>")` returns your template and that the plan has ≥ 6 domains.

## Task 2 — A third sample capture: a plant maintenance lead

File: `packages/core/src/samples.ts`. Add `LUIS` (Luis Ortega, Lead Maintenance Technician, Plant 2, 26 years, successor Sam Whitfield), using the existing `SampleSpec` shape and `buildSample()`. Two sessions, 9–12 Q/A pairs total, 20–26 atoms across at least 6 domains of the `operations-manufacturing` template, one answered successor question and two open ones. Content must be specific and plausible (machine names, thresholds, suppliers, safety rules that came from incidents). Every atom needs a verbatim `quote` drawn from the answer text. Register it in `SAMPLES`.

Acceptance: `buildSample(LUIS).atoms.length ≥ 20`; the engine test `imports the bundled sample` still passes; `pnpm seed` prints three captures.

## Task 3 — Proof-read every user-facing string

Read `apps/web/src/pages/*.tsx` and `apps/web/src/components/*.tsx` (read-only for you) and list, in `docs/COPY_REVIEW.md`, any wording that is unclear, inconsistent (e.g., "capture" vs "profile"), or too long for its control. Propose replacements in a two-column table (current → proposed). Do not edit the components yourself.

## Task 4 — One-page leave-behind

Write `docs/ONE_PAGER.md`: problem, product, how it works (three sentences), the closed loop, partner tech (Boson Higgs Realtime + Higgs Audio, Nebius), business model, and links. Under 350 words, no new statistics beyond those already in the README.

## Task 5 — Accessibility pass (report only)

Using the running app (`pnpm dev`, http://localhost:5173), check keyboard navigation, focus visibility, color contrast of badges on the paper background, and alt text on images. Write findings with severity and suggested fixes to `docs/A11Y.md`. Do not change components.

---

When in doubt, prefer fewer, higher-quality changes. Keep commit messages in the imperative ("Add nursing role template"). Thank you.
