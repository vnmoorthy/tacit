import { describe, expect, it } from "vitest";
import { HeuristicBrain, MARIA, buildSample, pickTemplate } from "../index.js";

const brain = new HeuristicBrain();
const capture = buildSample(MARIA).capture;

describe("HeuristicBrain", () => {
  it("plans a payroll coverage map from the role template", async () => {
    const plan = await brain.plan({ expert: { name: "Maria Chen", role: "Senior Payroll Specialist" }, context: "Runs payroll on Workday and ADP." });
    expect(plan.domains.length).toBeGreaterThanOrEqual(6);
    expect(plan.domains.map((d) => d.name)).toContain("Period close & reconciliation");
    expect(plan.domains.find((d) => /systems/i.test(d.name))?.description).toMatch(/Workday/);
  });

  it.each([
    {
      key: "clinical-nursing",
      role: "Charge Nurse",
      context: "Coordinates bedside nursing, patient acuity and handoff on the ward.",
      domain: "Patient assessment & escalation",
    },
    {
      key: "field-service-utilities",
      role: "Utilities Lineworker",
      context: "Works with dispatch on transformer faults, substation visits and outage response.",
      domain: "Site assessment & stop-work decisions",
    },
    {
      key: "restaurant-hospitality",
      role: "Restaurant General Manager",
      context: "Runs hotel food and beverage service, guest recovery and kitchen ordering.",
      domain: "Opening, service & closing rhythm",
    },
    {
      key: "public-sector-casework",
      role: "Public-sector Benefits Caseworker",
      context: "Manages county social services eligibility applications and a transferred caseload.",
      domain: "Intake, triage & urgent needs",
    },
    {
      key: "research-lab",
      role: "Research Lab Manager",
      context: "Maintains laboratory instruments, freezer inventories and reagent supplies for a principal investigator.",
      domain: "Samples, storage & traceability",
    },
  ])("selects $key and plans its complete coverage map", async ({ key, role, context, domain }) => {
    const template = pickTemplate(role, context);
    expect(template.key).toBe(key);
    expect(template.keywords.length).toBeGreaterThanOrEqual(8);
    expect(template.keywords.length).toBeLessThanOrEqual(14);

    const plan = await brain.plan({ expert: { name: "Alex Morgan", role }, context });
    expect(plan.domains.length).toBeGreaterThanOrEqual(6);
    expect(plan.domains.length).toBeLessThanOrEqual(8);
    expect(plan.domains).toHaveLength(template.domains.length);
    expect(plan.domains.map((d) => d.name)).toContain(domain);
    // The offline planner caps maps at eight domains; keep the shared handover
    // questions in the actual plan, rather than silently truncating them.
    expect(plan.domains.slice(-3).map((d) => d.name)).toEqual([
      "People & escalation paths",
      "Calendar & recurring deadlines",
      "Hard-won lessons",
    ]);
    for (const plannedDomain of plan.domains) {
      expect(plannedDomain.description.trim().length).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(plannedDomain.priority);
      expect(plannedDomain.questions.length).toBeGreaterThanOrEqual(2);
      expect(plannedDomain.questions.length).toBeLessThanOrEqual(3);
      expect(plannedDomain.questions.every((q) => q.trim().length > 0)).toBe(true);
    }
  });

  it.each([
    ["Clinical Nurse", "", "clinical-nursing"],
    ["Registered Nurse", "", "clinical-nursing"],
    ["Field Service Technician", "", "field-service-utilities"],
    ["Lineworker", "", "field-service-utilities"],
    ["Hotel General Manager", "", "restaurant-hospitality"],
    ["Hospitality GM", "", "restaurant-hospitality"],
    ["Public Benefits Caseworker", "", "public-sector-casework"],
    ["Lab Manager", "University research laboratory", "research-lab"],
    ["Clinical Lab Manager", "Hospital pharmacy and physician liaison", "clinical-care"],
    ["Lead Maintenance Technician", "Plant equipment and manufacturing safety", "operations-manufacturing"],
    ["Founder", "Board and investor relationships", "founder-executive"],
    ["Open-source Maintainer", "Repository releases and contributors", "oss-maintainer"],
    ["Grandmother", "Family recipes and heritage stories", "family-memory"],
  ])("resolves overlapping keywords for %s", (role, context, key) => {
    expect(pickTemplate(role, context).key).toBe(key);
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
