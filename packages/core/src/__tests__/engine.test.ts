import { describe, expect, it } from "vitest";
import { Engine, HeuristicBrain, MARIA, MemoryStore, buildSample, compileHandover } from "../index.js";

function makeEngine() {
  return new Engine({ store: new MemoryStore(), brain: new HeuristicBrain() });
}

describe("Engine end-to-end (offline brain)", () => {
  it("creates a capture, runs an interview, answers and queues questions", async () => {
    const engine = makeEngine();
    const capture = await engine.createCapture({
      expert: { name: "Maria Chen", role: "Senior Payroll Operations Specialist" },
      successor: { name: "Jordan Reyes" },
      context: "Runs payroll on Workday with ADP for tax and JPMorgan for ACH.",
    });
    expect(capture.domains.length).toBeGreaterThan(4);
    expect(capture.stats.coverage).toBe(0);

    const { session, interviewerTurn } = await engine.startSession(capture.id, "text");
    expect(interviewerTurn.text).toMatch(/Maria/);

    const r1 = await engine.expertTurn(
      session.id,
      "First I pull the payroll register from Workday and the GL detail from NetSuite. Then I run the reconciliation macro in Excel. Usually it's benefits accruals that don't tie. I send the variance summary to Priya in Accounting before the fifth business day.",
    );
    expect(r1.atoms.length).toBeGreaterThan(0);
    expect(r1.interviewerTurn).not.toBeNull();
    expect(r1.capture.stats.atoms).toBe(r1.atoms.length);
    expect(r1.capture.stats.coverage).toBeGreaterThan(0);

    const r2 = await engine.expertTurn(session.id, "The real ACH cut-off is 3:30pm, not 5pm. If the file is rejected, call the JPMorgan ACH desk and give them the file ID.");
    expect(r2.atoms.length).toBeGreaterThan(0);

    const known = await engine.ask(capture.id, "What is the ACH cut-off time?", "Jordan");
    expect(known.confidence).not.toBe("none");
    expect(known.citations.length).toBeGreaterThan(0);
    expect(known.answer).toMatch(/3:30/);

    const unknown = await engine.ask(capture.id, "How do I renew the forklift certification?", "Jordan");
    expect(["none", "low"]).toContain(unknown.confidence);
    expect(unknown.queuedQuestion).toBeDefined();

    const ended = await engine.endSession(session.id);
    expect(ended.endedAt).toBeDefined();
    expect(ended.summary).toMatch(/Captured/);

    // The next session opens with the successor's unanswered question.
    const s2 = await engine.startSession(capture.id, "text");
    expect(s2.interviewerTurn.kind).toBe("successor");
    expect(s2.interviewerTurn.text).toMatch(/forklift/i);
    const r3 = await engine.expertTurn(s2.session.id, "You have to call Ramon in Facilities first, then book the practical test with the training vendor before the card expires.");
    expect(r3.atoms.length).toBeGreaterThan(0);
    const qs = await engine.listQuestions(capture.id);
    expect(qs.find((q) => /forklift/i.test(q.text))?.status).toBe("answered");

    const md = await engine.handover(capture.id);
    expect(md).toMatch(/^# Handover/);
    expect(md).toMatch(/Coverage map/);
  });

  it("imports the bundled sample and answers from it", async () => {
    const engine = makeEngine();
    const bundle = buildSample(MARIA);
    expect(bundle.atoms.length).toBeGreaterThan(20);
    const c = await engine.importBundle(bundle);
    expect(c.stats.atoms).toBe(bundle.atoms.length);
    expect(c.stats.openQuestions).toBe(2);
    expect(c.domains.some((d) => d.coverage > 0.5)).toBe(true);

    const res = await engine.ask(c.id, "The ACH file bounced on a Friday afternoon, what should I do?", "Jordan");
    expect(res.confidence).toBe("high");
    expect(res.citations.some((ct) => /ACH/i.test(ct.title))).toBe(true);

    const md = compileHandover(c, bundle.atoms, bundle.sessions, bundle.questions);
    expect(md).toMatch(/RECON_v7/);
    expect(md).toMatch(/Still open/);
  });

  it("updates, verifies and deletes atoms and keeps stats in sync", async () => {
    const engine = makeEngine();
    const c = await engine.importBundle(buildSample(MARIA));
    const atoms = await engine.listAtoms(c.id, { type: "contact" });
    expect(atoms.length).toBeGreaterThan(2);
    const a = await engine.updateAtom(atoms[0].id, { verified: true, title: "Contact: Priya Nair (Accounting)" });
    expect(a.verified).toBe(true);
    await engine.deleteAtom(atoms[1].id);
    const after = await engine.getCapture(c.id);
    expect(after.stats.atoms).toBe(c.stats.atoms - 1);
    const searched = await engine.listAtoms(c.id, { q: "garnishment child support levy" });
    expect(searched[0].title).toMatch(/garnishment/i);
  });
});
