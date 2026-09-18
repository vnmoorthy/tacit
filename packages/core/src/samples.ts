/**
 * Bundled sample captures so Tacit looks alive on first launch and the
 * successor-twin demo works before any interview has been recorded.
 * Timestamps are relative to "now" so countdowns stay meaningful.
 */
import { recomputeCapture } from "./coverage.js";
import type { CaptureBundle } from "./engine.js";
import { ROLE_TEMPLATES } from "./templates.js";
import type { Atom, AtomType, Capture, Domain, Question, Session, SessionMode, Turn } from "./types.js";

interface AtomSpec {
  type: AtomType;
  title: string;
  content: string;
  tags?: string[];
  confidence?: number;
  quote?: string;
  verified?: boolean;
}

interface QASpec {
  kind: "opening" | "new" | "followup" | "successor";
  domain: string;
  q: string;
  a: string;
  /** For kind=successor: the successor question text this answers. */
  answers?: string;
  atoms: AtomSpec[];
}

interface SessionSpec {
  mode: SessionMode;
  daysAgo: number;
  minutes: number;
  summary: string;
  qa: QASpec[];
}

export interface SampleSpec {
  key: string;
  title: string;
  expert: Capture["expert"];
  successor: Capture["successor"];
  context: string;
  templateKey: string;
  departureInDays: number;
  sessions: SessionSpec[];
  openQuestions: { text: string; askedBy: string; domain?: string }[];
}

function isoDaysFromNow(days: number, atHour = 10): string {
  const d = new Date(Date.now() + days * 86400000);
  d.setHours(atHour, 0, 0, 0);
  return d.toISOString();
}

function dateOnlyFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export function buildSample(spec: SampleSpec): CaptureBundle {
  const tpl = ROLE_TEMPLATES.find((t) => t.key === spec.templateKey)!;
  const domains: Domain[] = tpl.domains.slice(0, 8).map((d, i) => ({
    id: `dom_${spec.key}_${i + 1}`,
    name: d.name,
    description: d.description,
    priority: d.priority,
    targetQuestions: [...d.questions],
    askedCount: 0,
    atomCount: 0,
    coverage: 0,
  }));
  const domainByName = (name: string) => domains.find((d) => d.name === name) ?? domains[0];
  const captureId = `cap_${spec.key}`;
  const createdAt = isoDaysFromNow(-Math.max(...spec.sessions.map((s) => s.daysAgo)) - 1, 9);

  const sessions: Session[] = [];
  const turns: Turn[] = [];
  const atoms: Atom[] = [];
  const questions: Question[] = [];
  let atomN = 0;
  let qN = 0;

  spec.sessions.forEach((ss, si) => {
    const sessionId = `ses_${spec.key}_${si + 1}`;
    const startedAt = isoDaysFromNow(-ss.daysAgo, 10 + si);
    const start = Date.parse(startedAt);
    const endedAt = new Date(start + ss.minutes * 60000).toISOString();
    let sessionAtoms = 0;
    ss.qa.forEach((qa, qi) => {
      const domain = domainByName(qa.domain);
      const tq = new Date(start + qi * 2 * 90000).toISOString();
      const ta = new Date(start + qi * 2 * 90000 + 75000).toISOString();
      let questionId: string | undefined;
      if (qa.kind === "successor" && qa.answers) {
        qN++;
        questionId = `q_${spec.key}_${qN}`;
        questions.push({
          id: questionId,
          captureId,
          text: qa.answers,
          source: "successor",
          status: "answered",
          askedBy: spec.successor?.name,
          domainId: domain.id,
          createdAt: new Date(start - 86400000).toISOString(),
          answeredAt: ta,
          answerAtomIds: [],
        });
      }
      const qTurnId = `turn_${spec.key}_${si + 1}_${qi * 2 + 1}`;
      const aTurnId = `turn_${spec.key}_${si + 1}_${qi * 2 + 2}`;
      turns.push({ id: qTurnId, sessionId, captureId, role: "interviewer", text: qa.q, at: tq, kind: qa.kind, domainId: domain.id, questionId });
      if (qa.kind === "opening" || qa.kind === "new") domain.askedCount = Math.min(domain.targetQuestions.length, domain.askedCount + 1);
      const ids: string[] = [];
      for (const as of qa.atoms) {
        atomN++;
        const id = `atom_${spec.key}_${atomN}`;
        ids.push(id);
        atoms.push({
          id,
          captureId,
          sessionId,
          turnId: aTurnId,
          domainId: domain.id,
          type: as.type,
          title: as.title,
          content: as.content,
          tags: as.tags ?? [],
          confidence: as.confidence ?? 0.86,
          verified: as.verified ?? false,
          sourceQuote: as.quote,
          createdAt: ta,
          updatedAt: ta,
        });
      }
      sessionAtoms += ids.length;
      if (questionId) questions[questions.length - 1].answerAtomIds = ids;
      turns.push({ id: aTurnId, sessionId, captureId, role: "expert", text: qa.a, at: ta, domainId: domain.id, extractedAtomIds: ids });
    });
    sessions.push({ id: sessionId, captureId, mode: ss.mode, startedAt, endedAt, summary: ss.summary, turnCount: ss.qa.length * 2, atomCount: sessionAtoms });
  });

  for (const oq of spec.openQuestions) {
    qN++;
    questions.push({
      id: `q_${spec.key}_${qN}`,
      captureId,
      text: oq.text,
      source: "successor",
      status: "open",
      askedBy: oq.askedBy,
      domainId: oq.domain ? domainByName(oq.domain).id : undefined,
      createdAt: isoDaysFromNow(-0.5, 16),
    });
  }

  const base: Capture = {
    id: captureId,
    createdAt,
    updatedAt: isoDaysFromNow(-0.4, 17),
    title: spec.title,
    expert: { ...spec.expert, departureDate: dateOnlyFromNow(spec.departureInDays) },
    successor: spec.successor,
    context: spec.context,
    status: "active",
    domains,
    stats: { atoms: 0, verifiedAtoms: 0, sessions: 0, turns: 0, minutes: 0, coverage: 0, openQuestions: 0 },
    sample: true,
  };
  const capture = recomputeCapture(base, atoms, sessions, turns, questions);
  return { capture, sessions, turns, atoms, questions };
}

/* ───────────────────────────── Maria Chen ───────────────────────────── */

export const MARIA: SampleSpec = {
  key: "maria",
  title: "Maria Chen — Payroll Operations",
  expert: { name: "Maria Chen", role: "Senior Payroll Operations Specialist", team: "Finance Operations", tenureYears: 19 },
  successor: { name: "Jordan Reyes", role: "Payroll Analyst" },
  context:
    "Runs semi-monthly payroll for 1,400 US employees across six states on Workday, with ADP for tax filing and JPMorgan for ACH funding. Owns the period-close reconciliation to the general ledger in NetSuite, garnishments, off-cycle runs and the annual W-2 process. Known pain points: ACH file rejections near cut-off, multi-state tax notices, and a legacy Excel macro used for the GL reconciliation.",
  templateKey: "payroll-finance",
  departureInDays: 42,
  sessions: [
    {
      mode: "voice-browser",
      daysAgo: 3,
      minutes: 34,
      summary:
        "Covered period close, ACH payments and compliance filings. Most valuable captures: the retro-pay period trap, the real 3:30pm ACH cut-off, and the first-hour rejection playbook. Exceptions and vendor contacts still open.",
      qa: [
        {
          kind: "opening",
          domain: "Period close & reconciliation",
          q: "Hi Maria, I'm Tacit. I'll ask about how you really do your job so Jordan can pick it up without you. Let's start here: walk me through your period close from the first day to sign-off.",
          a: "Sure. Close starts the day after the second payroll of the month posts. First I pull the payroll register from Workday and the GL detail from NetSuite. Then I run the reconciliation macro — it's an Excel file called RECON_v7 that lives on my desktop; it maps every earning and deduction code to a GL account. Anything that doesn't tie goes on a variance tab. Usually it's benefits accruals or a mid-period rate change. I clear those, then I send the variance summary to Priya in Accounting for sign-off before the fifth business day.",
          atoms: [
            {
              type: "procedure",
              title: "Run the month-end payroll-to-GL reconciliation",
              content:
                "1. The day after the second payroll of the month posts, pull the payroll register from Workday and the GL detail from NetSuite.\n2. Run the RECON_v7 macro to map every earning and deduction code to its GL account.\n3. Work the variance tab: anything that doesn't tie (typically benefits accruals or mid-period rate changes).\n4. Send the variance summary to Priya in Accounting for sign-off before the fifth business day.",
              tags: ["Workday", "NetSuite", "RECON_v7", "month-end"],
              quote: "First I pull the payroll register from Workday and the GL detail from NetSuite. Then I run the reconciliation macro.",
              verified: true,
            },
            {
              type: "tool",
              title: "RECON_v7 Excel macro lives only on Maria's desktop",
              content:
                "The GL reconciliation depends on an Excel macro, RECON_v7, stored only on Maria's desktop. It maps every earning and deduction code to a GL account and writes non-tying items to a variance tab. Copy it to the shared Finance drive and hand over the code mapping before departure.",
              tags: ["Excel", "RECON_v7", "single point of failure"],
              quote: "It's an Excel file called RECON_v7 that lives on my desktop.",
              confidence: 0.92,
            },
            {
              type: "contact",
              title: "Contact: Priya (Accounting) — close sign-off",
              content: "Priya in Accounting signs off the monthly variance summary. She needs it before the fifth business day.",
              tags: ["Priya", "Accounting"],
              quote: "I send the variance summary to Priya in Accounting for sign-off before the fifth business day.",
            },
          ],
        },
        {
          kind: "followup",
          domain: "Period close & reconciliation",
          q: "You said \"usually it's benefits accruals or a rate change\". When isn't that the case, and what do you do instead?",
          a: "When it's neither, it's almost always a retro pay that hit a closed period. Workday posts retro to the current period but Finance wants it in the period it was earned. I don't fix it in Workday — I book a manual journal in NetSuite and note the employee ID on the variance tab so audit can trace it. And never re-run the register after Priya has signed; it changes the file hash and audit flags it.",
          atoms: [
            {
              type: "gotcha",
              title: "Retro pay lands in the wrong period",
              content:
                "Workday posts retroactive pay to the current period, but Finance wants it in the period it was earned. Do not correct it in Workday. Book a manual journal in NetSuite and record the employee ID on the variance tab so audit can trace it.",
              tags: ["Workday", "NetSuite", "retro pay", "audit"],
              quote: "Workday posts retro to the current period but Finance wants it in the period it was earned.",
              verified: true,
            },
            {
              type: "rule",
              title: "Never re-run the register after sign-off",
              content: "Re-running the payroll register after Priya has signed changes the file hash and triggers an audit flag. Post corrections as a separate journal instead.",
              tags: ["audit", "sign-off"],
              quote: "Never re-run the register after Priya has signed; it changes the file hash and audit flags it.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Payments, files & banking",
          q: "That's really useful. Let's turn to payments, files and banking. Describe how a payment file gets built, approved and sent. Where can it fail?",
          a: "The ACH file is generated in Workday after the final calc, then it goes to the JPMorgan portal. Two approvers are needed: me and someone from Treasury, usually Dan Okafor. The bank's official cut-off is 5pm Eastern but the real cut-off is 3:30 — anything after that risks next-day settlement and people get paid late. The file fails most often because a new hire's routing number was typed with a leading zero missing, or because the total exceeds the daily limit after a bonus run and Treasury forgot to raise it.",
          atoms: [
            {
              type: "procedure",
              title: "Build, approve and send the ACH file",
              content:
                "1. Run the final payroll calc in Workday and generate the ACH file.\n2. Upload it to the JPMorgan portal.\n3. Approve as first approver; get the second approval from Treasury (usually Dan Okafor).\n4. Submit before 3:30pm Eastern.",
              tags: ["Workday", "JPMorgan", "ACH"],
              quote: "The ACH file is generated in Workday after the final calc, then it goes to the JPMorgan portal. Two approvers are needed.",
              verified: true,
            },
            {
              type: "rule",
              title: "Real ACH cut-off is 3:30pm Eastern, not 5pm",
              content: "The bank's published cut-off is 5pm Eastern, but anything submitted after 3:30pm risks next-day settlement and late pay. Treat 3:30pm as the deadline.",
              tags: ["ACH", "cut-off", "3:30pm"],
              quote: "The bank's official cut-off is 5pm Eastern but the real cut-off is 3:30.",
              verified: true,
            },
            {
              type: "contact",
              title: "Contact: Dan Okafor (Treasury) — ACH second approver",
              content: "Dan Okafor in Treasury is the usual second approver for the ACH file. Line up a Treasury backup before payday if he is out.",
              tags: ["Dan Okafor", "Treasury"],
              quote: "Two approvers are needed: me and someone from Treasury, usually Dan Okafor.",
            },
            {
              type: "gotcha",
              title: "Two common ACH file failures",
              content:
                "The ACH file most often fails for one of two reasons: a new hire's routing number was entered without its leading zero, or the file total exceeds the bank's daily limit after a bonus run because Treasury didn't raise the limit. Check both before submitting.",
              tags: ["ACH", "routing number", "daily limit", "bonus run"],
              quote: "A new hire's routing number was typed with a leading zero missing, or the total exceeds the daily limit after a bonus run.",
            },
          ],
        },
        {
          kind: "followup",
          domain: "Payments, files & banking",
          q: "What happens when a file or payment is rejected — what do you do in the first hour?",
          a: "First, call the JPMorgan client service line — not the general number, the one on the laminated card on my desk — and ask for the ACH desk. Give them the file ID so they can hold it. Then fix the record in Workday and regenerate. If it's a Friday, don't wait: if the corrected file isn't in by 3:30 I run an off-cycle for the affected employees as a same-day wire. It costs about $35 per person but nobody misses rent. I also email HR so they can warn the employees.",
          atoms: [
            {
              type: "procedure",
              title: "First hour after an ACH rejection",
              content:
                "1. Call the JPMorgan client service line (laminated card on Maria's desk, not the general number) and ask for the ACH desk.\n2. Give them the file ID so they can hold the file.\n3. Fix the offending record in Workday and regenerate the file.\n4. If it's Friday and the corrected file can't be in by 3:30pm, run an off-cycle as same-day wires for the affected employees.\n5. Email HR so they can warn the employees.",
              tags: ["JPMorgan", "ACH", "rejection", "off-cycle"],
              quote: "First, call the JPMorgan client service line — not the general number — and ask for the ACH desk.",
              verified: true,
            },
            {
              type: "decision",
              title: "Friday rejections: same-day wire beats waiting",
              content: "If a corrected ACH file cannot be resubmitted by 3:30pm on a Friday, pay the affected employees by same-day wire (about $35 each). The fee is trivial compared with employees missing rent over a weekend.",
              tags: ["wire", "$35", "Friday"],
              quote: "It costs about $35 per person but nobody misses rent.",
            },
            {
              type: "contact",
              title: "Contact: JPMorgan ACH desk (client service line)",
              content: "Use the client service number on the laminated card at Maria's desk and ask for the ACH desk. Have the file ID ready so they can hold the file. The general number will not get you there in time.",
              tags: ["JPMorgan", "ACH desk"],
              quote: "Not the general number, the one on the laminated card on my desk.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Compliance & regulatory filings",
          q: "Let's turn to compliance. Which filings carry the biggest penalties if late, and how do you track them?",
          a: "Federal 941 deposits are the big one — the penalty is a percentage of the deposit and it escalates with days late. ADP files them, but ADP only files what we fund, so if the funding wire is late the deposit is late even though ADP says it filed. I keep a calendar in Outlook with reminders two days before every deposit date. State notices are the other thing — California and New York still send notices to the registered address, which is the old office, so they arrive late. Anything from a state agency goes to Rosa in Legal the same day, no exceptions.",
          atoms: [
            {
              type: "risk",
              title: "Late federal 941 deposits carry escalating penalties",
              content: "The penalty for a late federal 941 deposit is a percentage of the deposit that escalates with the number of days late. Deposit dates are tracked in an Outlook calendar with reminders two days ahead.",
              tags: ["941", "IRS", "penalty"],
              quote: "The penalty is a percentage of the deposit and it escalates with days late.",
              verified: true,
            },
            {
              type: "gotcha",
              title: "ADP 'filed' does not mean 'deposited'",
              content: "ADP only files what the company funds. If the funding wire is late, the tax deposit is late even though ADP reports the filing as done. Confirm the funding wire cleared, not just the ADP status.",
              tags: ["ADP", "funding wire", "941"],
              quote: "ADP only files what we fund, so if the funding wire is late the deposit is late even though ADP says it filed.",
              verified: true,
            },
            {
              type: "rule",
              title: "State agency notices go to Rosa in Legal the same day",
              content: "Any notice from a state agency is forwarded to Rosa in Legal on the day it arrives. No exceptions.",
              tags: ["Rosa", "Legal", "state notices"],
              quote: "Anything from a state agency goes to Rosa in Legal the same day, no exceptions.",
            },
            {
              type: "gotcha",
              title: "CA and NY notices still go to the old office address",
              content: "California and New York mail notices to the registered address, which is still the old office, so they arrive late. Update the registered address with each agency, and check mail forwarding weekly until then.",
              tags: ["California", "New York", "registered address"],
              quote: "California and New York still send notices to the registered address, which is the old office.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Exceptions & special cases",
          q: "What are the exceptions you handle by hand because the system can't?",
          a: "Garnishments with multiple orders on one employee — Workday can't prioritise them correctly when there's a child support order and a tax levy, so I calculate the split by hand using the DOL priority rules and enter each as a fixed amount. Terminations in California have to be paid the same day, so those are always an off-cycle with a manual check. And anything for the executives goes through a separate confidential run that only I and the CFO can see.",
          atoms: [
            {
              type: "procedure",
              title: "Multiple garnishment orders: calculate the split by hand",
              content: "Workday cannot prioritise a child-support order against a tax levy on the same employee. Calculate the split manually using DOL priority rules (child support first), then enter each garnishment as a fixed amount.",
              tags: ["garnishment", "Workday", "DOL"],
              quote: "Workday can't prioritise them correctly when there's a child support order and a tax levy, so I calculate the split by hand.",
            },
            {
              type: "rule",
              title: "California terminations are paid the same day",
              content: "Final pay for a California termination must be issued the same day. Always run it as an off-cycle with a manual check.",
              tags: ["California", "termination", "off-cycle"],
              quote: "Terminations in California have to be paid the same day, so those are always an off-cycle with a manual check.",
              verified: true,
            },
            {
              type: "gotcha",
              title: "Executive payroll is a separate confidential run",
              content: "Executives are paid through a confidential payroll run visible only to the payroll lead and the CFO. The successor must be granted that security role before Maria leaves or executive pay will stall.",
              tags: ["executives", "confidential", "CFO", "security role"],
              quote: "Anything for the executives goes through a separate confidential run that only I and the CFO can see.",
            },
          ],
        },
      ],
    },
    {
      mode: "voice-browser",
      daysAgo: 1,
      minutes: 22,
      summary:
        "Answered Jordan's queued W-2 question first, then covered personal spreadsheets and reports, vendor contacts, and hard-won lessons. Flagged two single-person dependencies: the disability carrier portal login and the executive security role.",
      qa: [
        {
          kind: "successor",
          domain: "Calendar & recurring deadlines",
          answers: "What do we do about the year-end W-2 process?",
          q: "Hi Maria, good to have you back. Before we go on, Jordan asked something I couldn't answer from what we have so far: what do we do about the year-end W-2 process? How would you handle that?",
          a: "W-2s are the one thing you can't wing. In November I run the W-2 preview in ADP and reconcile it to the four quarterly 941s — the totals must match to the penny. The common mismatches are third-party sick pay from the disability carrier and imputed income for group life over fifty thousand. I fix those in Workday before the final December payroll, because after that any correction becomes a W-2C, which is painful. ADP prints and mails by January 31.",
          atoms: [
            {
              type: "procedure",
              title: "Year-end W-2 reconciliation",
              content:
                "1. In November, run the W-2 preview in ADP.\n2. Reconcile the preview totals to the four quarterly 941s — they must match to the penny.\n3. Fix mismatches in Workday before the final December payroll.\n4. ADP prints and mails W-2s by January 31.",
              tags: ["W-2", "ADP", "941", "year-end"],
              quote: "In November I run the W-2 preview in ADP and reconcile it to the four quarterly 941s — the totals must match to the penny.",
              verified: true,
            },
            {
              type: "gotcha",
              title: "Common W-2 mismatches: sick pay and imputed life income",
              content: "The usual W-2 reconciliation differences are third-party sick pay reported by the disability carrier and imputed income for group life insurance over $50,000.",
              tags: ["W-2", "third-party sick pay", "imputed income"],
              quote: "The common mismatches are third-party sick pay from the disability carrier and imputed income for group life over fifty thousand.",
            },
            {
              type: "rule",
              title: "Fix W-2 issues before the final December payroll",
              content: "Any W-2 correction made after the final December payroll becomes a W-2C. Resolve all mismatches before that run.",
              tags: ["W-2C", "December"],
              quote: "After that any correction becomes a W-2C, which is painful.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Systems, reports & workarounds",
          q: "Let's turn to systems, reports and workarounds. Which reports or spreadsheets exist only on your machine?",
          a: "RECON_v7, obviously. There's also a headcount tie-out sheet that compares Workday active employees to the payroll register every run — if the count is off by even one, somebody was hired or terminated after the calc and it will show up as a rejection or an overpayment. And I have a saved Workday report called Maria_PreCalc_Audit that flags negative net pay, missing tax elections, and anyone with more than 80 hours in a week. Run it before every calc.",
          atoms: [
            {
              type: "tool",
              title: "Headcount tie-out sheet (every run)",
              content: "A spreadsheet that compares Workday active headcount to the payroll register before every run. A mismatch of even one means someone was hired or terminated after the calc and will surface as a rejection or an overpayment.",
              tags: ["headcount", "tie-out", "Workday"],
              quote: "If the count is off by even one, somebody was hired or terminated after the calc.",
              verified: true,
            },
            {
              type: "tool",
              title: "Maria_PreCalc_Audit Workday report — run before every calc",
              content: "A saved Workday report that flags negative net pay, missing tax elections, and anyone with more than 80 hours in a week. Run it before every payroll calc. It is saved under Maria's user and must be shared with the successor.",
              tags: ["Workday", "pre-calc", "audit"],
              quote: "A saved Workday report called Maria_PreCalc_Audit that flags negative net pay, missing tax elections, and anyone with more than 80 hours in a week.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Vendors & external partners",
          q: "Which vendor contact actually fixes things, and how do you reach them?",
          a: "At ADP, skip the ticket queue. Our named service rep is Kevin Tran; if he's out, his backup is listed on the ADP account team page. For Workday, our internal admin is Sam Iyer in IT — a Workday support case takes a week, Sam takes an hour. For the disability carrier, the sick pay reports come from a portal login that's in my name, so that needs to be moved to Jordan before I go.",
          atoms: [
            {
              type: "contact",
              title: "Contact: Kevin Tran (ADP named service rep)",
              content: "Skip the ADP ticket queue and go to the named service rep, Kevin Tran. His backup is listed on the ADP account team page.",
              tags: ["ADP", "Kevin Tran"],
              quote: "At ADP, skip the ticket queue. Our named service rep is Kevin Tran.",
            },
            {
              type: "contact",
              title: "Contact: Sam Iyer (IT, Workday admin) — hours, not weeks",
              content: "Sam Iyer in IT is the internal Workday admin. A Workday support case takes about a week; Sam usually resolves things within an hour.",
              tags: ["Workday", "Sam Iyer", "IT"],
              quote: "A Workday support case takes a week, Sam takes an hour.",
              verified: true,
            },
            {
              type: "risk",
              title: "Disability carrier portal login is in Maria's name",
              content: "Third-party sick pay reports come from a carrier portal whose login is registered to Maria. Reassign the login to Jordan before departure or year-end sick-pay reporting will be blocked.",
              tags: ["disability carrier", "portal", "single point of failure"],
              quote: "The sick pay reports come from a portal login that's in my name, so that needs to be moved to Jordan before I go.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Hard-won lessons",
          q: "Last one for today. What is the one thing you'd put on a sticky note for Jordan?",
          a: "Never process a payroll on a day you're rushing. Every mistake I've made in nineteen years happened when I tried to squeeze the calc in before a meeting. And trust the tie-out sheet over your gut — if the numbers say one person is missing, they're missing.",
          atoms: [
            {
              type: "rule",
              title: "Never run a payroll calc while rushing",
              content: "Every payroll mistake in nineteen years happened when the calc was squeezed in before a meeting. Block the time and do not rush a run.",
              tags: ["lesson"],
              quote: "Every mistake I've made in nineteen years happened when I tried to squeeze the calc in before a meeting.",
              verified: true,
            },
            {
              type: "rule",
              title: "Trust the tie-out sheet over your gut",
              content: "If the headcount tie-out says one person is missing, one person is missing. Investigate before running the calc.",
              tags: ["tie-out", "lesson"],
              quote: "If the numbers say one person is missing, they're missing.",
            },
          ],
        },
      ],
    },
  ],
  openQuestions: [
    { text: "How do I get the security role for the confidential executive payroll run?", askedBy: "Jordan Reyes", domain: "Exceptions & special cases" },
    { text: "What is the process for registering in a new state when we hire our first employee there?", askedBy: "Jordan Reyes", domain: "Compliance & regulatory filings" },
  ],
};

/* ───────────────────────────── Dev Patel ───────────────────────────── */

export const DEV: SampleSpec = {
  key: "dev",
  title: "Dev Patel — Platform Reliability",
  expert: { name: "Dev Patel", role: "Staff Site Reliability Engineer", team: "Platform", tenureYears: 7 },
  successor: { name: "Ana Lima", role: "SRE II" },
  context:
    "Owns the Kubernetes platform on AWS (EKS), the Postgres fleet behind PgBouncer, the deploy pipeline in GitHub Actions and Argo CD, and on-call for the payments service. Known fragile areas: the nightly ETL to Snowflake, a hand-rolled Terraform module for VPC peering, and secrets in Vault.",
  templateKey: "engineering-ops",
  departureInDays: 21,
  sessions: [
    {
      mode: "text",
      daysAgo: 2,
      minutes: 18,
      summary:
        "Covered the recurring 3am payments page, the exception path for lock-holding migrations, the deploy pipeline including the manual Terraform step, and single-holder credentials. Two urgent risks flagged: local Terraform state and Vault unseal keys held by a former employee.",
      qa: [
        {
          kind: "opening",
          domain: "Incidents & on-call playbooks",
          q: "Hi Dev, I'm Tacit. I'll ask about how you really do your job so Ana can pick it up without you. Let's start here: what pages you at 3am most often, and what do you do first?",
          a: "Ninety percent of pages are the payments service hitting Postgres connection limits. It's not the database, it's PgBouncer — when a deploy rolls pods too fast, connections pile up. First thing I do is check the PgBouncer dashboard in Grafana, then scale the pgbouncer deployment to four replicas, which clears it in about two minutes. Don't restart Postgres — that turns a two-minute blip into a twenty-minute outage.",
          atoms: [
            {
              type: "procedure",
              title: "Payments 3am page: PgBouncer connection pile-up",
              content: "1. Open the PgBouncer dashboard in Grafana.\n2. Scale the pgbouncer deployment to 4 replicas.\n3. Confirm connections drain (about two minutes).",
              tags: ["PgBouncer", "Grafana", "payments", "on-call"],
              quote: "Check the PgBouncer dashboard in Grafana, then scale the pgbouncer deployment to four replicas.",
              verified: true,
            },
            {
              type: "gotcha",
              title: "Never restart Postgres for connection-limit pages",
              content: "The connection-limit page is a PgBouncer symptom caused by fast pod rollouts, not a database fault. Restarting Postgres turns a two-minute blip into a twenty-minute outage.",
              tags: ["Postgres", "PgBouncer"],
              quote: "Don't restart Postgres — that turns a two-minute blip into a twenty-minute outage.",
              verified: true,
            },
          ],
        },
        {
          kind: "followup",
          domain: "Incidents & on-call playbooks",
          q: "When does that not work — what's the exception?",
          a: "If scaling PgBouncer doesn't clear it in five minutes, it's a long-running migration holding locks. Run pg_stat_activity, find the migration, and page whoever's name is on the PR. Never kill it yourself unless it's been running more than thirty minutes, because a half-applied migration is worse than a slow one.",
          atoms: [
            {
              type: "procedure",
              title: "If PgBouncer scaling doesn't clear it: find the lock-holding migration",
              content: "1. If connections don't drain within five minutes, query pg_stat_activity.\n2. Identify the long-running migration.\n3. Page the author named on the PR.",
              tags: ["pg_stat_activity", "migration", "locks"],
              quote: "Run pg_stat_activity, find the migration, and page whoever's name is on the PR.",
            },
            {
              type: "rule",
              title: "Don't kill a migration under thirty minutes old",
              content: "A half-applied migration is worse than a slow one. Only terminate a migration yourself if it has been running for more than thirty minutes and the author is unreachable.",
              tags: ["migration", "30 minutes"],
              quote: "Never kill it yourself unless it's been running more than thirty minutes.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Deploys, releases & rollbacks",
          q: "Let's turn to deploys. Walk me through a deploy end to end, including the parts that are manual.",
          a: "Merge to main triggers GitHub Actions, which builds and pushes the image, then Argo CD syncs the staging cluster automatically. Production is a manual sync in Argo — open the app, hit sync, and watch the payments canary for ten minutes. The manual part nobody knows: the VPC peering Terraform module has to be applied by hand from my laptop because the state file is local. That needs to move to the S3 backend before I leave.",
          atoms: [
            {
              type: "procedure",
              title: "Deploy pipeline end to end",
              content: "1. Merge to main → GitHub Actions builds and pushes the image.\n2. Argo CD auto-syncs staging.\n3. Production: open the app in Argo CD and sync manually.\n4. Watch the payments canary for ten minutes before calling it done.",
              tags: ["GitHub", "Argo CD", "canary"],
              quote: "Production is a manual sync in Argo — open the app, hit sync, and watch the payments canary for ten minutes.",
              verified: true,
            },
            {
              type: "risk",
              title: "VPC peering Terraform state lives on Dev's laptop",
              content: "The VPC peering Terraform module is applied by hand from Dev's laptop because its state file is local. Migrate the state to the S3 backend before departure or nobody will be able to change peering safely.",
              tags: ["Terraform", "VPC peering", "state file", "single point of failure"],
              quote: "The VPC peering Terraform module has to be applied by hand from my laptop because the state file is local.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Access, secrets & vendors",
          q: "Which credentials or accounts are only held by you?",
          a: "The Vault root token is sealed in the ops 1Password vault, but the unseal keys — three of five — are with me, Priya from Security, and one former employee who left last year. We need to rekey. Also the Snowflake service account password rotates every ninety days and the reminder is on my personal calendar.",
          atoms: [
            {
              type: "risk",
              title: "Vault unseal keys include a former employee — rekey now",
              content: "Three of five Vault unseal keys are held by Dev, Priya (Security) and a former employee who left last year. Rekey Vault and redistribute the shares before Dev leaves.",
              tags: ["Vault", "unseal keys", "security"],
              quote: "The unseal keys — three of five — are with me, Priya from Security, and one former employee who left last year.",
              verified: true,
            },
            {
              type: "risk",
              title: "Snowflake service-account rotation reminder is on a personal calendar",
              content: "The Snowflake service account password must be rotated every 90 days. The only reminder is on Dev's personal calendar. Move it to the team's shared calendar or an automated rotation.",
              tags: ["Snowflake", "rotation", "90 days"],
              quote: "The Snowflake service account password rotates every ninety days and the reminder is on my personal calendar.",
            },
            {
              type: "contact",
              title: "Contact: Priya (Security) — Vault unseal key holder",
              content: "Priya in Security holds one of the Vault unseal keys and should be part of the rekey ceremony.",
              tags: ["Priya", "Security", "Vault"],
              quote: "The unseal keys are with me, Priya from Security…",
            },
          ],
        },
      ],
    },
  ],
  openQuestions: [{ text: "How do I re-run the nightly Snowflake ETL by hand if it fails?", askedBy: "Ana Lima", domain: "Data, migrations & backups" }],
};

/* ───────────────────────────── Luis Ortega ───────────────────────────── */

export const LUIS: SampleSpec = {
  key: "luis",
  title: "Luis Ortega — Plant 2 Maintenance",
  expert: { name: "Luis Ortega", role: "Lead Maintenance Technician", team: "Plant 2", tenureYears: 26 },
  successor: { name: "Sam Whitfield", role: "Maintenance Technician" },
  context:
    "Fictional sample: retiring maintenance lead at Plant 2, which packs household paper products. Owns the CE-4 carton erector, PZ-2 palletizer, AC-2 air compressor and the maintenance handover in Fiix. Equipment limits and job-card references are specific to this example plant; work follows its approved procedures and authorized-person training. Fragile areas: obsolete vacuum elbows, weekend air-pressure faults and paper records of replacement-part revisions.",
  templateKey: "operations-manufacturing",
  departureInDays: 30,
  sessions: [
    {
      mode: "text",
      daysAgo: 5,
      minutes: 20,
      summary:
        "Covered CE-4 vacuum faults, bearing trend checks, the PZ-2 stored-energy near-miss, shift handover and obsolete spare parts. Sam must complete the site's authorization before performing isolation work.",
      qa: [
        {
          kind: "opening",
          domain: "Equipment quirks & maintenance",
          q: "Luis, which machine would surprise Sam on the first shift, and what should they watch for?",
          a: "The CE-4 carton erector drops cartons when its vacuum elbow cracks underneath, where you can't see it from the aisle. On our approved CE-4 fault card, vacuum weaker than minus 55 kilopascals for two consecutive picks means a controlled stop and a maintenance call. Never compensate by raising the recipe vacuum setting; that hides the leak until the next carton size change.",
          atoms: [
            {
              type: "gotcha",
              title: "CE-4 vacuum elbow can crack out of sight",
              content: "A crack underneath the CE-4 vacuum elbow causes dropped cartons and is not visible from the aisle.",
              tags: ["CE-4", "vacuum elbow", "carton erector"],
              quote: "The CE-4 carton erector drops cartons when its vacuum elbow cracks underneath, where you can't see it from the aisle.",
              verified: true,
            },
            {
              type: "rule",
              title: "CE-4 weak vacuum: stop under the site fault card",
              content: "At this plant, the approved CE-4 fault card calls for a controlled stop and maintenance call when vacuum is weaker than −55 kPa for two consecutive picks. Do not raise the recipe vacuum setting to mask the leak.",
              tags: ["CE-4", "vacuum", "fault card", "55 kPa"],
              quote: "On our approved CE-4 fault card, vacuum weaker than minus 55 kilopascals for two consecutive picks means a controlled stop and a maintenance call.",
              verified: true,
            },
          ],
        },
        {
          kind: "followup",
          domain: "Equipment quirks & maintenance",
          q: "What tells you a fault is developing before the machine stops?",
          a: "Trend the CE-4 outfeed bearing with the fixed sensor, at the same speed and carton load each shift. Our trend card calls for a planned-stop inspection if it rises fifteen degrees Celsius above its recorded baseline; an alarm or unusual noise takes the immediate stop path on the fault card. The baseline and last bearing change are in Fiix asset CE4-OUT-01, not in the operator's paper log.",
          atoms: [
            {
              type: "procedure",
              title: "Compare CE-4 bearing trends at the same speed and load",
              content: "Read the fixed bearing sensor at the same speed and carton load each shift. Follow the site's trend card: a 15 °C rise above the recorded baseline calls for a planned-stop inspection. An alarm or unusual noise follows the fault card's immediate stop path.",
              tags: ["CE-4", "bearing", "temperature", "trend card"],
              quote: "Our trend card calls for a planned-stop inspection if it rises fifteen degrees Celsius above its recorded baseline; an alarm or unusual noise takes the immediate stop path on the fault card.",
            },
            {
              type: "tool",
              title: "Fiix CE4-OUT-01 holds the bearing baseline",
              content: "Use Fiix asset CE4-OUT-01 for the CE-4 outfeed bearing's temperature baseline and last replacement date. The operator's paper log does not hold those records.",
              tags: ["Fiix", "CE4-OUT-01", "bearing"],
              quote: "The baseline and last bearing change are in Fiix asset CE4-OUT-01, not in the operator's paper log.",
              verified: true,
            },
          ],
        },
        {
          kind: "new",
          domain: "Safety & near-misses",
          q: "Which safety rule exists because something nearly went wrong here?",
          a: "In 2019 the PZ-2 palletizer carriage moved after an emergency stop because stored pneumatic energy was still present; nobody was hurt, but a fitter was about to enter. An emergency stop is not energy isolation, and nobody enters the guarded area until authorized staff complete the current PZ-2 lockout procedure and verify zero energy. The machine-specific checklist covers electrical and pneumatic isolation, stored energy and the approved mechanical restraint; if the checklist or restraint is missing, stop and call EHS. Sam must complete the site authorization before doing that work.",
          atoms: [
            {
              type: "story",
              title: "2019 PZ-2 near-miss: movement after an emergency stop",
              content: "The PZ-2 carriage moved after an emergency stop because pneumatic energy remained. A fitter was about to enter; nobody was hurt. This incident explains the plant's emphasis on verified isolation.",
              tags: ["PZ-2", "near-miss", "stored energy", "2019"],
              quote: "In 2019 the PZ-2 palletizer carriage moved after an emergency stop because stored pneumatic energy was still present; nobody was hurt, but a fitter was about to enter.",
            },
            {
              type: "rule",
              title: "PZ-2 emergency stop does not authorize entry",
              content: "No entry into the guarded area until authorized staff complete the current machine-specific lockout procedure and verify zero energy. An emergency stop is not isolation. Sam must complete the site's authorization before performing this work.",
              tags: ["PZ-2", "lockout", "authorization", "safety"],
              quote: "An emergency stop is not energy isolation, and nobody enters the guarded area until authorized staff complete the current PZ-2 lockout procedure and verify zero energy.",
              verified: true,
            },
            {
              type: "rule",
              title: "Missing PZ-2 checklist or restraint: stop and call EHS",
              content: "Use the current PZ-2 checklist covering electrical and pneumatic isolation, stored energy and the approved mechanical restraint. A missing checklist or restraint blocks the job; escalate to EHS.",
              tags: ["PZ-2", "EHS", "checklist", "mechanical restraint"],
              quote: "The machine-specific checklist covers electrical and pneumatic isolation, stored energy and the approved mechanical restraint; if the checklist or restraint is missing, stop and call EHS.",
              verified: true,
            },
          ],
        },
        {
          kind: "new",
          domain: "Shift handover & daily rhythm",
          q: "Walk me through the first and last few minutes of your shift.",
          a: "At 5:45 I open the P2_OPEN view in Fiix with the outgoing lead and match every stopped machine to a work order. Before leaving, record the fault, last good batch, isolation status and next owner in that work order, then walk the line together. A red equipment-status tag means unavailable pending documented release; it is not a personal lock and does not replace the isolation procedure.",
          atoms: [
            {
              type: "procedure",
              title: "5:45 handover: reconcile stopped machines with Fiix",
              content: "1. Open P2_OPEN in Fiix with the outgoing lead at 5:45.\n2. Match each stopped machine to a work order.\n3. Record the fault, last good batch, isolation status and next owner.\n4. Walk the line together before handing over.",
              tags: ["Fiix", "P2_OPEN", "shift handover", "work order"],
              quote: "Before leaving, record the fault, last good batch, isolation status and next owner in that work order, then walk the line together.",
              verified: true,
            },
            {
              type: "glossary",
              title: "Red equipment-status tag: unavailable pending release",
              content: "At Plant 2 a red equipment-status tag means the machine is unavailable pending documented release. It is not a personal lock and cannot substitute for the isolation procedure.",
              tags: ["red tag", "release", "isolation"],
              quote: "A red equipment-status tag means unavailable pending documented release; it is not a personal lock and does not replace the isolation procedure.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Suppliers, parts & lead times",
          q: "Which spare would stop production for longer than Sam expects, and who can get it?",
          a: "Keep two CE-4 revision-C vacuum elbow kits in bin B-17 and reorder when one is issued; Westbank Industrial quotes five days, but the last three orders took three weeks. Elena Marquez at Westbank checks actual shelf stock; her extension is on the supplier record in Fiix. The revision-B elbow looks identical but its seal groove is different, so Stores must match the asset's approved parts list instead of accepting a substitute by appearance.",
          atoms: [
            {
              type: "rule",
              title: "CE-4 elbow kits: keep two, reorder on issue",
              content: "Stock two approved revision-C vacuum elbow kits in bin B-17. Reorder when one is issued and plan for three weeks; the last three Westbank orders exceeded the quoted five days.",
              tags: ["CE-4", "Westbank Industrial", "B-17", "spares"],
              quote: "Keep two CE-4 revision-C vacuum elbow kits in bin B-17 and reorder when one is issued; Westbank Industrial quotes five days, but the last three orders took three weeks.",
              verified: true,
            },
            {
              type: "contact",
              title: "Elena Marquez at Westbank checks real shelf stock",
              content: "Ask Elena Marquez at Westbank Industrial to check actual stock for maintenance spares. Her extension is in the Fiix supplier record.",
              tags: ["Elena Marquez", "Westbank Industrial", "Fiix"],
              quote: "Elena Marquez at Westbank checks actual shelf stock; her extension is on the supplier record in Fiix.",
            },
            {
              type: "gotcha",
              title: "CE-4 revision-B and revision-C elbows are not interchangeable",
              content: "The revision-B elbow has a different seal groove despite looking identical. Stores must check the asset's approved parts list before accepting a replacement.",
              tags: ["CE-4", "revision-C", "revision-B", "Stores"],
              quote: "The revision-B elbow looks identical but its seal groove is different, so Stores must match the asset's approved parts list instead of accepting a substitute by appearance.",
            },
          ],
        },
      ],
    },
    {
      mode: "text",
      daysAgo: 1,
      minutes: 20,
      summary:
        "Answered Sam's weekend low-air question, then covered first-off quality checks, escalation ownership, the shutdown calendar and the 2022 wrong-part incident. Two successor questions remain open about the dryer service contract and the annual shutdown approval route.",
      qa: [
        {
          kind: "successor",
          domain: "Equipment quirks & maintenance",
          answers: "What do I do if CE-4 reports low air on a weekend but AC-2 says it is running?",
          q: "Sam asked what to do when CE-4 reports low air on a weekend but AC-2 says it is running. Where do they start?",
          a: "Read the remote header gauge on the utilities dashboard: our CE-4 fault card says pressure below 6.0 bar requires a controlled line stop and a call to the utilities duty technician. AC-2 saying running only means the motor is on; it does not prove air is reaching the header. Give the duty technician the header pressure and dryer alarm code from the dashboard, and leave compressor switching and dryer work to the authorized utilities team.",
          atoms: [
            {
              type: "procedure",
              title: "Weekend CE-4 low-air fault: read the header and call Utilities",
              content: "1. Read the remote header pressure on the utilities dashboard.\n2. Follow the CE-4 fault card: below 6.0 bar requires a controlled line stop and a utilities duty call.\n3. Pass on the header pressure and dryer alarm code. Compressor switching and dryer work belong to the authorized utilities team.",
              tags: ["CE-4", "AC-2", "Utilities", "low air", "6.0 bar"],
              quote: "Read the remote header gauge on the utilities dashboard: our CE-4 fault card says pressure below 6.0 bar requires a controlled line stop and a call to the utilities duty technician.",
              verified: true,
            },
            {
              type: "gotcha",
              title: "AC-2 running indicator does not prove header pressure",
              content: "AC-2's running indicator confirms only that its motor is on. Check the remote header pressure instead of assuming compressed air is reaching CE-4.",
              tags: ["AC-2", "header pressure", "utilities dashboard"],
              quote: "AC-2 saying running only means the motor is on; it does not prove air is reaching the header.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Quality & inspection judgement",
          q: "After a carton-size change, what makes you hold the line even if the machine seems to run well?",
          a: "The first-off sheet QF-22 requires ten cartons from CE-4 after every size change, with glue coverage checked against the approved photo standard. A lifted rear flap means stop and hold product since the last accepted check, even if the carton passes the squeeze check. Quality lead Nia Brooks decides disposition and signs the restart release; maintenance records the adjustment but cannot release held product.",
          atoms: [
            {
              type: "procedure",
              title: "QF-22 first-off check after a CE-4 size change",
              content: "After every CE-4 carton-size change, inspect ten cartons under first-off sheet QF-22. Check glue coverage against the approved photo standard.",
              tags: ["CE-4", "QF-22", "first-off", "glue coverage"],
              quote: "The first-off sheet QF-22 requires ten cartons from CE-4 after every size change, with glue coverage checked against the approved photo standard.",
              verified: true,
            },
            {
              type: "decision",
              title: "A lifted rear flap fails even when the squeeze check passes",
              content: "A lifted rear flap triggers a stop and product hold back to the last accepted check. Passing the squeeze check does not override that defect.",
              tags: ["CE-4", "rear flap", "product hold", "Quality"],
              quote: "A lifted rear flap means stop and hold product since the last accepted check, even if the carton passes the squeeze check.",
            },
            {
              type: "rule",
              title: "Quality owns held-product disposition and restart release",
              content: "Nia Brooks, the quality lead, decides held-product disposition and signs the restart release. Maintenance documents adjustments but cannot release held product.",
              tags: ["Nia Brooks", "Quality", "restart release"],
              quote: "Quality lead Nia Brooks decides disposition and signs the restart release; maintenance records the adjustment but cannot release held product.",
              verified: true,
            },
          ],
        },
        {
          kind: "new",
          domain: "People & escalation paths",
          q: "Who actually gets a difficult breakdown unstuck, and when do you bring them in?",
          a: "For a recurring drive fault, call controls lead Asha Rao through the duty roster after the first failed recovery allowed by the fault card; don't keep resetting it. For an isolation question or missing safeguard, stop the job and call EHS lead Ben Okafor through the same roster. Production supervisor Jo Ellis replans the shift, but production pressure never authorizes bypassing a guard or an interlock.",
          atoms: [
            {
              type: "contact",
              title: "Asha Rao: recurring drive faults after one permitted recovery",
              content: "Use the duty roster to reach controls lead Asha Rao after the first failed recovery permitted by the machine's fault card. Do not repeatedly reset a recurring drive fault.",
              tags: ["Asha Rao", "Controls", "drive fault", "duty roster"],
              quote: "For a recurring drive fault, call controls lead Asha Rao through the duty roster after the first failed recovery allowed by the fault card; don't keep resetting it.",
            },
            {
              type: "rule",
              title: "Isolation uncertainty or missing safeguards block the job",
              content: "Stop and contact EHS lead Ben Okafor through the duty roster if isolation is uncertain or a safeguard is missing. Jo Ellis handles production replanning; production pressure cannot authorize bypassing a guard or interlock.",
              tags: ["Ben Okafor", "EHS", "Jo Ellis", "interlock"],
              quote: "For an isolation question or missing safeguard, stop the job and call EHS lead Ben Okafor through the same roster.",
              verified: true,
            },
          ],
        },
        {
          kind: "new",
          domain: "Calendar & recurring deadlines",
          q: "Which maintenance deadline would a new lead most easily miss?",
          a: "The four-hour planned stop is the first Tuesday of each month, but Stores needs the reserved-parts list by noon on the preceding Thursday. Put it in the shared Plant 2 shutdown calendar and link the Fiix work orders so the night shift sees it. The AC-2 service reminder is still on my personal calendar; Sam needs to move it to the shared calendar with the approved service schedule before I retire.",
          atoms: [
            {
              type: "rule",
              title: "Monthly planned stop: reserve parts by Thursday noon",
              content: "The four-hour stop is the first Tuesday each month. Send Stores the reserved-parts list by noon on the preceding Thursday, and link the Fiix work orders in the shared Plant 2 shutdown calendar.",
              tags: ["Stores", "Fiix", "shutdown calendar", "Thursday noon"],
              quote: "The four-hour planned stop is the first Tuesday of each month, but Stores needs the reserved-parts list by noon on the preceding Thursday.",
              verified: true,
            },
            {
              type: "risk",
              title: "AC-2 service reminder remains on Luis's personal calendar",
              content: "Before Luis retires, Sam must move the AC-2 reminder and approved service schedule to the shared calendar so servicing does not depend on Luis's account.",
              tags: ["AC-2", "service schedule", "personal calendar", "single point of failure"],
              quote: "The AC-2 service reminder is still on my personal calendar; Sam needs to move it to the shared calendar with the approved service schedule before I retire.",
            },
          ],
        },
        {
          kind: "new",
          domain: "Hard-won lessons",
          q: "What mistake changed the way you finish a repair?",
          a: "In 2022 we fitted the wrong CE-4 elbow revision because the box label matched an old paper parts sheet; the seal leaked and we lost the next shift chasing vacuum faults. Since then, the technician and Stores both check the revision against the current asset parts list before the job starts, and the work order gets the installed part number and revision. The marked-up revision history is still in my blue binder; scan it into Fiix with engineering's approval before I leave so it doesn't disappear with my locker.",
          atoms: [
            {
              type: "story",
              title: "2022 wrong-elbow repair cost the next shift",
              content: "An obsolete paper parts sheet led to installation of the wrong CE-4 elbow revision. Its seal leaked, and the next shift was lost tracing vacuum faults.",
              tags: ["CE-4", "2022", "revision history", "vacuum fault"],
              quote: "In 2022 we fitted the wrong CE-4 elbow revision because the box label matched an old paper parts sheet; the seal leaked and we lost the next shift chasing vacuum faults.",
            },
            {
              type: "procedure",
              title: "Verify the approved revision and record the installed part",
              content: "Before the job, the technician and Stores check the replacement revision against the current asset parts list. Record the installed part number and revision in the work order.",
              tags: ["Stores", "parts list", "work order", "revision"],
              quote: "Since then, the technician and Stores both check the revision against the current asset parts list before the job starts, and the work order gets the installed part number and revision.",
              verified: true,
            },
            {
              type: "risk",
              title: "Part revision history exists only in Luis's blue binder",
              content: "Scan the marked-up part revision history from Luis's blue binder into Fiix, with engineering's approval, before retirement. Otherwise the history may leave with his locker contents.",
              tags: ["Fiix", "blue binder", "Engineering", "single point of failure"],
              quote: "The marked-up revision history is still in my blue binder; scan it into Fiix with engineering's approval before I leave so it doesn't disappear with my locker.",
            },
          ],
        },
      ],
    },
  ],
  openQuestions: [
    { text: "Which dryer service contract covers weekend callouts, and who can authorize the charge?", askedBy: "Sam Whitfield", domain: "Suppliers, parts & lead times" },
    { text: "Who approves the annual shutdown scope, and when must I submit the isolation and contractor plan?", askedBy: "Sam Whitfield", domain: "Calendar & recurring deadlines" },
  ],
};

export const SAMPLES: SampleSpec[] = [MARIA, DEV, LUIS];

export function buildAllSamples(): CaptureBundle[] {
  return SAMPLES.map(buildSample);
}
