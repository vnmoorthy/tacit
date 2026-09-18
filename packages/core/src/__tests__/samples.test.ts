import { describe, expect, it } from "vitest";
import { Engine, HeuristicBrain, LUIS, MemoryStore, ROLE_TEMPLATES, SAMPLES, buildAllSamples, buildSample } from "../index.js";

describe("Plant maintenance sample", () => {
  it("covers the operations domains with verbatim evidence from linked expert turns", () => {
    const bundle = buildSample(LUIS);
    const template = ROLE_TEMPLATES.find((t) => t.key === "operations-manufacturing")!;
    const qa = LUIS.sessions.flatMap((session) => session.qa);
    expect(bundle.sessions).toHaveLength(2);
    expect(qa.length).toBeGreaterThanOrEqual(9);
    expect(qa.length).toBeLessThanOrEqual(12);
    expect(bundle.atoms.length).toBeGreaterThanOrEqual(20);
    expect(bundle.atoms.length).toBeLessThanOrEqual(26);
    expect(new Set(bundle.atoms.map((atom) => atom.domainId)).size).toBeGreaterThanOrEqual(6);

    // buildSample falls back to the first domain for misspellings; catch those too.
    for (const pair of qa) expect(template.domains.some((domain) => domain.name === pair.domain)).toBe(true);
    for (const atom of bundle.atoms) {
      const turn = bundle.turns.find((candidate) => candidate.id === atom.turnId)!;
      expect(turn.role).toBe("expert");
      expect(atom.sourceQuote).toBeTruthy();
      expect(turn.text).toContain(atom.sourceQuote);
      expect(turn.extractedAtomIds).toContain(atom.id);
      expect(turn.domainId).toBe(atom.domainId);
    }
  });

  it("imports the third sample with a linked answer and two open successor questions", async () => {
    const engine = new Engine({ store: new MemoryStore(), brain: new HeuristicBrain() });
    expect(SAMPLES).toContain(LUIS);
    expect(buildAllSamples().map((bundle) => bundle.capture.id)).toEqual(["cap_maria", "cap_dev", "cap_luis"]);
    const capture = await engine.importBundle(buildSample(LUIS));
    expect(capture.stats.sessions).toBe(2);
    expect(capture.stats.atoms).toBe(24);
    expect(capture.stats.openQuestions).toBe(2);

    const questions = await engine.listQuestions(capture.id);
    const answered = questions.filter((question) => question.status === "answered");
    expect(answered).toHaveLength(1);
    expect(answered[0].askedBy).toBe("Sam Whitfield");
    expect(answered[0].answeredAt).toBeTruthy();
    expect(answered[0].answerAtomIds).toHaveLength(2);
    const atoms = await engine.listAtoms(capture.id);
    for (const atomId of answered[0].answerAtomIds ?? []) {
      const atom = atoms.find((candidate) => candidate.id === atomId);
      expect(atom).toBeDefined();
      expect(atom?.domainId).toBe(answered[0].domainId);
    }
    const open = questions.filter((question) => question.source === "successor" && question.status === "open");
    expect(open).toHaveLength(2);

    const next = await engine.startSession(capture.id, "text");
    expect(next.interviewerTurn.kind).toBe("successor");
    expect(open.map((question) => question.id)).toContain(next.interviewerTurn.questionId);
  });
});
