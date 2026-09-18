# Astra task validation and handoff

Verified on 2026-09-18 against [ASTRA_TASKS.md](ASTRA_TASKS.md). This work is local and uncommitted; no commit, push, deployment or PR was created.

## PR-ready summary

Tacit's offline planner now covers five more industries, and its bundled captures include a plant-maintenance handover that demonstrates cited knowledge and the successor-question loop.

- Add clinical nursing, utilities/field service, restaurant/hospitality, public-sector casework and research-lab role templates, with focused spoken questions and keyword-selection coverage.
- Add Luis Ortega, Plant 2's lead maintenance technician, with two interviews, 24 source-backed atoms, one answered successor question and two open questions for Sam Whitfield.
- Add a report with 38 copy findings across all 18 page/component files and a 286-word product one-pager.
- Add [A11Y.md](A11Y.md), a report-only browser audit with eight findings from 13 route/state snapshots and a mobile dashboard pass, including keyboard-inaccessible atom actions, modal focus defects and failing amber badge contrast.
- Validate template selection, sample integrity and the successor loop; update the API sample-count expectation from two to three with the user's explicit permission.

## Scope and preservation

The working tree already contained changes to README, UI files, public images and four role templates (`clinical-care`, `oss-maintainer`, `founder-executive`, `family-memory`). Those are separate from this task. Comparing `templates.ts` with the captured pre-task patch confirms every pre-existing template, `COMMON_TAIL`, `pickTemplate()` and `KNOWN_TOOLS` is unchanged; only the five new templates were inserted before the existing roles.

Implementation edits are limited to `packages/core/src/templates.ts`, `packages/core/src/samples.ts`, core tests and documentation, plus the explicitly authorized one-line `apps/api/src/__tests__/api.test.ts` assertion (`2` → `3`). This task does not change the API contract, data model, visual design system or UI components. Keep unrelated pre-existing changes separate when preparing a commit or PR.

## Acceptance checklist

| Task | Evidence | Result |
| --- | --- | --- |
| 1 — Five industry templates | Each has 14 keywords and eight total domains: five industry-specific domains followed by the three shared tail domains. Every domain has a description, priority and two or three questions. Parameterized tests cover each requested role and its complete plan; additional cases cover keyword overlap with existing roles. | Pass |
| 2 — Luis sample | Two sessions, ten Q/A pairs, 24 atoms across all eight operations/manufacturing domains. All quotes occur verbatim in their linked expert answers. Manual review also checked that atom titles/content are supported by those answers. The one answered successor question links to its two answer atoms; two questions remain open and the engine asks one first in the next session. | Pass |
| 2 — Import and seed | Existing `imports the bundled sample` engine test passes; new sample import and integrity tests pass. An isolated `pnpm seed` run prints Maria, Dev and Luis. Read-only database checks confirm actual stored links and counts. | Pass |
| 3 — Copy review | [COPY_REVIEW.md](COPY_REVIEW.md) contains 38 current → proposed entries and a coverage record for all ten pages and eight components. Components were reviewed without task edits. | Pass |
| 4 — One-page leave-behind | [ONE_PAGER.md](ONE_PAGER.md): 286 whitespace-delimited words, all requested topics, exactly three sentences in “How it works,” partner technologies, proposed business model and links; no new statistics. | Pass |
| 5 — Accessibility report | [A11Y.md](A11Y.md) records 13 route/state snapshots, desktop checks and a mobile dashboard keyboard pass. Eight findings include inaccessible atom controls, modal focus defects and amber badge text at 2.33:1 against its fill. All three rendered HTML images have alt text; the other seven observed badge variants pass. Findings include severity, reproduction steps and suggested fixes; no components were changed. | Report complete; findings documented |
| Required verification | `pnpm typecheck && pnpm test && pnpm build` exits 0. All 39 tests pass: core 33, web 4, API 2. | Pass |

The successful production build reports that `local.ts` is imported both statically and dynamically, so Vite cannot split it into a separate chunk. This warning concerns existing import structure outside this task's edits. The seed runner also emits Node's SQLite experimental-feature warning. Neither causes verification to fail.

## Required command — complete output

Run from the repository root:

```bash
pnpm typecheck && pnpm test && pnpm build
```

Exit status: **0**.

```text

> tacit@0.1.0 typecheck /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit
> pnpm -r run typecheck

Scope: 3 of 4 workspace projects
packages/core typecheck$ tsc -p tsconfig.json
packages/core typecheck: Done
apps/api typecheck$ tsc -p tsconfig.json
apps/web typecheck$ tsc -p tsconfig.json
apps/api typecheck: Done
apps/web typecheck: Done

> tacit@0.1.0 test /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit
> pnpm -r run test

Scope: 3 of 4 workspace projects
packages/core test$ vitest run
packages/core test:  RUN  v3.2.7 /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit/packages/core
packages/core test:  ✓ src/__tests__/text.test.ts (5 tests) 10ms
packages/core test:  ✓ src/__tests__/graph.test.ts (1 test) 16ms
packages/core test:  ✓ src/__tests__/brain.test.ts (22 tests) 57ms
packages/core test:  ✓ src/__tests__/samples.test.ts (2 tests) 87ms
packages/core test:  ✓ src/__tests__/engine.test.ts (3 tests) 175ms
packages/core test:  Test Files  5 passed (5)
packages/core test:       Tests  33 passed (33)
packages/core test:    Start at  14:35:01
packages/core test:    Duration  1.34s (transform 498ms, setup 0ms, collect 2.09s, tests 345ms, environment 1ms, prepare 1.08s)
packages/core test: Done
apps/web test$ vitest run
apps/api test$ vitest run
apps/api test:  RUN  v3.2.7 /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit/apps/api
apps/web test:  RUN  v3.2.7 /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit/apps/web
apps/web test:  ✓ src/lib/vision/__tests__/gestures.test.ts (4 tests) 15ms
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  4 passed (4)
apps/web test:    Start at  14:35:05
apps/web test:    Duration  1.33s (transform 133ms, setup 0ms, collect 117ms, tests 15ms, environment 0ms, prepare 347ms)
apps/web test: Done
apps/api test:  ✓ src/__tests__/api.test.ts (2 tests) 186ms
apps/api test:  Test Files  1 passed (1)
apps/api test:       Tests  2 passed (2)
apps/api test:    Start at  14:35:05
apps/api test:    Duration  2.28s (transform 450ms, setup 0ms, collect 910ms, tests 186ms, environment 0ms, prepare 240ms)
apps/api test: Done

> tacit@0.1.0 build /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit
> pnpm -r run build

Scope: 3 of 4 workspace projects
apps/api build$ echo 'api runs from TypeScript via tsx'
apps/web build$ vite build && cp dist/index.html dist/404.html
apps/api build: api runs from TypeScript via tsx
apps/api build: Done
apps/web build: vite v7.3.6 building client environment for production...
apps/web build: transforming...
apps/web build: ✓ 2369 modules transformed.
apps/web build: rendering chunks...
apps/web build: [plugin vite:reporter] 
apps/web build: (!) /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit/apps/web/src/lib/local.ts is dynamically imported by /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit/apps/web/src/lib/api.ts but also statically imported by /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit/apps/web/src/pages/Settings.tsx, dynamic import will not move module into another chunk.
apps/web build: computing gzip size...
apps/web build: dist/index.html                             1.95 kB │ gzip:   0.72 kB
apps/web build: dist/assets/index-DiVhDo3u.css             44.54 kB │ gzip:   8.51 kB
apps/web build: dist/assets/Pass-7BUD01KW.js                1.14 kB │ gzip:   0.62 kB
apps/web build: dist/assets/three-spritetext-BwGf7CM7.js    8.89 kB │ gzip:   2.93 kB
apps/web build: dist/assets/UnrealBloomPass-Bo-mufb-.js     9.47 kB │ gzip:   2.47 kB
apps/web build: dist/assets/three.module-D9OxuRNc.js      748.07 kB │ gzip: 192.77 kB
apps/web build: dist/assets/3d-force-graph-BtF1zXOF.js    827.97 kB │ gzip: 234.81 kB
apps/web build: dist/assets/index-BDPvIWur.js             907.41 kB │ gzip: 287.05 kB
apps/web build: ✓ built in 1m 23s
apps/web build: Done
```

## Isolated seed — complete successful output

The default/user database was not used. The first sandboxed attempt could not create the `tsx` runner's local IPC socket (`listen EPERM`). The same seed command succeeded with scoped execution permission against this new temporary database:

```bash
DATABASE_PATH=/tmp/tacit-astra-seed.zNeCgU/tacit.db pnpm seed
```

Exit status: **0**.

```text

> tacit@0.1.0 seed /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit
> pnpm --filter @tacit/api run seed


> @tacit/api@0.1.0 seed /Users/moorthy/Downloads/Projects/Build an AI Startup in One Day/tacit/apps/api
> tsx src/seed.ts

seeded Maria Chen — Payroll Operations: 29 atoms, 2 sessions, 49% coverage
seeded Dev Patel — Platform Reliability: 9 atoms, 1 sessions, 19% coverage
seeded Luis Ortega — Plant 2 Maintenance: 24 atoms, 2 sessions, 51% coverage
(node:65544) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

Read-only inspection of the seeded database (all assertions passed):

```text
Database: /tmp/tacit-astra-seed.zNeCgU/tacit.db (read-only; isolated verification database)
Captures: 3 (cap_dev, cap_luis, cap_maria)
Luis: 2 sessions; 10 Q/A pairs; 24 atoms; 8 populated domains
All 24 source quotes occur verbatim in their linked expert turns.
All atom/turn domain links and extracted-atom backreferences match.
All Luis interview turns fall within their session start/end times.
Successor questions: 1 answered (2 linked atoms; question turn and answer timestamp match), 2 open.
All successor-question domains exist in the capture.
```
