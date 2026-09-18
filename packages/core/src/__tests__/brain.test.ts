import { describe, expect, it } from "vitest";
import { HeuristicBrain, MARIA, buildSample } from "../index.js";

const brain = new HeuristicBrain();
const capture = buildSample(MARIA).capture;

describe("HeuristicBrain", () => {
  it("plans a payroll coverage map from the role template", async () => {
    const plan = await brain.plan({ expert: { name: "Maria Chen", role: "Senior Payroll Specialist" }, context: "Runs payroll on Workday and ADP." });
    expect(plan.domains.length).toBeGreaterThanOrEqual(6);
    expect(plan.domains.map((d) => d.name)).toContain("Period close & reconciliation");
    expect(plan.domains.find((d) => /systems/i.test(d.name))?.description).toMatch(/Workday/);
  });

  it("extracts typed atoms from a spoken answer", async () => {
    const atoms = await brain.extract({
      capture,
      question: "What happens when a file is rejected?",
      answer:
        "First, call the JPMorgan client service line and ask for the ACH desk. Then fix the record in Workday and regenerate the file. Never re-run the register after Priya has signed because it changes the file hash. The real cut-off is 3:30pm, not 5pm.",
      domainHint: capture.domains[1].id,
    });
    const types = atoms.map((a) => a.type);
    expect(types).toContain("procedure");
    expect(types.some((t) => t === "rule" || t === "gotcha")).toBe(true);
    expect(atoms.every((a) => a.title.length > 3 && a.content.length > 10)).toBe(true);
    expect(atoms.every((a) => a.domainId)).toBe(true);
  });

  it("asks a successor's queued question first", async () => {
    const nq = await brain.nextQuestion({
      capture,
      recentTurns: [],
      lastAtoms: [],
      successorQuestions: [{ id: "q1", captureId: capture.id, text: "How do I get the executive security role?", source: "successor", status: "open", askedBy: "Jordan", createdAt: "" }],
      suggested: { domain: capture.domains[0], question: "Walk me through close." },
      isOpening: true,
    });
    expect(nq.kind).toBe("successor");
    expect(nq.questionId).toBe("q1");
    expect(nq.say).toMatch(/Jordan/);
  });

  it("follows up on hedged answers", async () => {
    const nq = await brain.nextQuestion({
      capture,
      recentTurns: [
        { id: "t1", sessionId: "s", captureId: capture.id, role: "interviewer", text: "Walk me through close.", at: "1", kind: "opening", domainId: capture.domains[0].id },
        { id: "t2", sessionId: "s", captureId: capture.id, role: "expert", text: "Usually it's benefits accruals that don't tie, and I clear them with the RECON macro in Excel before Priya signs off on the variance summary.", at: "2" },
      ],
      lastAtoms: [],
      successorQuestions: [],
      suggested: { domain: capture.domains[1], question: "Describe the payment file." },
      isOpening: false,
    });
    expect(nq.kind).toBe("followup");
    expect(nq.say.toLowerCase()).toMatch(/usually|excel|priya/);
  });
});
