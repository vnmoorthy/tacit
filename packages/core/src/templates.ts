/**
 * Role templates used by the offline HeuristicBrain to plan a coverage map
 * without an LLM. Each template lists knowledge domains and the questions a
 * seasoned interviewer would ask. Matched by keyword score against role+context.
 */

export interface DomainTemplate {
  name: string;
  description: string;
  priority: 1 | 2 | 3;
  questions: string[];
}

export interface RoleTemplate {
  key: string;
  keywords: string[];
  domains: DomainTemplate[];
}

const COMMON_TAIL: DomainTemplate[] = [
  {
    name: "People & escalation paths",
    description: "Who to call for what, and who actually gets things unstuck.",
    priority: 1,
    questions: [
      "When something is truly stuck, who do you call first, and why them?",
      "Which relationships did you build that your successor will need to rebuild?",
      "Who are the unofficial experts nobody has on an org chart?",
    ],
  },
  {
    name: "Calendar & recurring deadlines",
    description: "The rhythm of the role: what happens weekly, monthly, quarterly, yearly.",
    priority: 2,
    questions: [
      "Walk me through your year. Which weeks are the most dangerous and why?",
      "What recurring deadline would someone new most likely miss?",
    ],
  },
  {
    name: "Hard-won lessons",
    description: "Mistakes made once, never again. The scar tissue.",
    priority: 2,
    questions: [
      "Tell me about a time something went badly wrong. What did you change afterwards?",
      "What do you wish someone had told you in your first month?",
      "What is the one thing you'd put on a sticky note for your successor?",
    ],
  },
];

export const ROLE_TEMPLATES: RoleTemplate[] = [
  // Specific industries precede broader templates so equal scores favour the
  // narrower role (for example, a hotel general manager or a lineworker).
  {
    key: "restaurant-hospitality",
    keywords: ["restaurant", "hospitality", "hotel", "food service", "food and beverage", "front of house", "back of house", "banquet", "guest", "reservation", "service recovery", "kitchen", "restaurant gm", "hotel gm"],
    domains: [
      {
        name: "Opening, service & closing rhythm",
        description: "The checks and handoffs that keep a property or restaurant ready through each service period.",
        priority: 1,
        questions: [
          "Walk me through opening on your busiest day, including the checks only you remember to make.",
          "What unfinished work most often surprises the next shift, and how do you flag it?",
        ],
      },
      {
        name: "Staffing & pressure points",
        description: "How the rota, staff strengths and service demand shape decisions during a rush.",
        priority: 1,
        questions: [
          "When two people call out before a busy service, how do you decide what to change first?",
          "Where does service start to slow down before guests notice, and how do you spot it?",
        ],
      },
      {
        name: "Guest recovery & local relationships",
        description: "How complaints, special requests and returning guests are handled with sound judgement.",
        priority: 1,
        questions: [
          "Tell me about a guest complaint you turned around and how you decided what to offer.",
          "Which promises to regular guests or event organisers need to be passed to your successor?",
        ],
      },
      {
        name: "Food safety, allergens & premises",
        description: "How teams surface safety concerns and keep food, guest areas and equipment ready for use.",
        priority: 1,
        questions: [
          "Walk me through how an allergy request reaches everyone who needs to act on it.",
          "What safety issue has made you take an item or area out of service, and how was reopening approved?",
        ],
      },
      {
        name: "Ordering, cash & booking systems",
        description: "The ordering habits and system reconciliations that prevent shortages, lost bookings and unexplained losses.",
        priority: 2,
        questions: [
          "Which delivery or stock shortage needs a backup plan before the weekend begins?",
          "Where do sales, bookings or cash totals disagree, and how do you trace the difference?",
        ],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "clinical-nursing",
    keywords: ["nurse", "nursing", "clinical nurs", "charge nurse", "registered nurse", "bedside", "handoff", "acuity", "ward", "icu", "patient", "clinical", "hospital", "triage"],
    domains: [
      {
        name: "Patient assessment & escalation",
        description: "The subtle changes nurses notice and the escalation paths that get a timely response.",
        priority: 1,
        questions: [
          "Without identifying a patient, tell me about a change you noticed before the usual alerts went off.",
          "Walk me through escalating a concern overnight when the first person you call doesn't answer.",
        ],
      },
      {
        name: "Medication checks & near-misses",
        description: "The checks, interruptions and handoffs that matter most when giving medicines.",
        priority: 1,
        questions: [
          "Where does the medication process most often get interrupted, and how do you pick it back up safely?",
          "Tell me about a medication near-miss without patient details, and what the team changed afterwards.",
        ],
      },
      {
        name: "Shift handoff & patient flow",
        description: "How changing needs, pending work and admissions move between nurses and shifts.",
        priority: 1,
        questions: [
          "What do you make sure the next nurse hears that the handoff form doesn't capture?",
          "When several admissions arrive at once, how do you decide what needs attention first?",
        ],
      },
      {
        name: "Staffing, acuity & delegation",
        description: "How assignments account for patient needs, staff experience and the help available on the unit.",
        priority: 1,
        questions: [
          "Walk me through making assignments when the usual staffing plan doesn't fit the patients on the ward.",
          "How do you notice that a colleague needs help before they ask, and what happens next?",
        ],
      },
      {
        name: "Documentation systems & bedside equipment",
        description: "The charting gaps, device quirks and supply problems that can interrupt bedside care.",
        priority: 2,
        questions: [
          "Which pending orders or results are easiest to miss in the chart, and how do you track them?",
          "When equipment or supplies aren't ready, how do you get the right help and keep the next shift informed?",
        ],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "field-service-utilities",
    keywords: ["field service", "field service technician", "service technician", "lineworker", "lineman", "utility", "utilities", "power line", "distribution crew", "substation", "outage", "transformer", "dispatch", "right-of-way"],
    domains: [
      {
        name: "Site assessment & stop-work decisions",
        description: "The site conditions and missing information that change the plan before work starts.",
        priority: 1,
        questions: [
          "Walk me through arriving at an unfamiliar site and deciding whether the crew can start work.",
          "What has made you stop a job that looked routine on the work order?",
        ],
      },
      {
        name: "Isolation, permits & crew coordination",
        description: "How crews confirm the approved isolation and permit process before beginning or handing over work.",
        priority: 1,
        questions: [
          "How do you confirm everyone is working from the same approved isolation and permit information?",
          "What do you do when the site labels disagree with the drawings or dispatch instructions?",
        ],
      },
      {
        name: "Fault finding & asset history",
        description: "The local clues, recurring faults and asset records that help narrow down a callout.",
        priority: 1,
        questions: [
          "Which assets send you back to the same site, and what history should your successor read first?",
          "Tell me about a fault where the first explanation was wrong and what led you to the cause.",
        ],
      },
      {
        name: "Outage response & dispatch handoff",
        description: "How priorities, changing conditions and unfinished work pass between dispatch and field crews.",
        priority: 1,
        questions: [
          "When several urgent callouts arrive together, how are priorities agreed with dispatch?",
          "What must the relief crew know before taking over a job that runs past your shift?",
        ],
      },
      {
        name: "Parts, access & service records",
        description: "The spares, site permissions and record updates that determine whether a visit can be completed.",
        priority: 2,
        questions: [
          "Which parts or access arrangements do you check before leaving the depot, and why?",
          "What do you record after a repair that helps the next crew avoid a wasted trip?",
        ],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "public-sector-casework",
    keywords: ["caseworker", "case worker", "public sector", "public-sector", "social services", "human services", "eligibility", "caseload", "benefit application", "benefits case", "county", "municipal", "case management", "case manager"],
    domains: [
      {
        name: "Intake, triage & urgent needs",
        description: "How incoming cases are prioritised and urgent needs are recognised before routine processing.",
        priority: 1,
        questions: [
          "Walk me through a new application from arrival to deciding what needs attention first.",
          "Without identifying anyone, describe a case that needed urgent help and how you recognised that.",
        ],
      },
      {
        name: "Eligibility, evidence & judgement",
        description: "How caseworkers resolve incomplete evidence and ambiguous rules through the approved review process.",
        priority: 1,
        questions: [
          "What evidence is most often missing, and how do you help someone provide an acceptable alternative?",
          "When guidance doesn't clearly fit a case, how do you get a decision and record the reasoning?",
        ],
      },
      {
        name: "Notices, appeals & case deadlines",
        description: "The case-specific clocks and review steps that protect a person's opportunity to respond.",
        priority: 1,
        questions: [
          "Which event starts each important deadline, and where do you track it when a case is transferred?",
          "Walk me through an appeal handoff and the information a reviewer needs to reconstruct the decision.",
        ],
      },
      {
        name: "Referrals & access to services",
        description: "How referrals, language support and practical barriers affect whether someone receives help.",
        priority: 1,
        questions: [
          "When a referral appears complete in the system, how do you find out whether the person actually received help?",
          "What do you do when someone cannot use the usual online, phone or in-person route?",
        ],
      },
      {
        name: "Case systems, records & confidentiality",
        description: "The recordkeeping and information-sharing practices that support a reliable, confidential case handover.",
        priority: 2,
        questions: [
          "What must a case note explain so that another worker can pick up the case without starting again?",
          "How do you check what information can be shared with another agency and record what was sent?",
        ],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "research-lab",
    keywords: ["research", "lab manager", "laboratory manager", "lab", "laboratory", "principal investigator", "specimen", "freezer", "reagent", "biosafety", "instrument", "assay", "calibration", "research technician"],
    domains: [
      {
        name: "Samples, storage & traceability",
        description: "How sample identities, storage locations and handling history stay connected across people and projects.",
        priority: 1,
        questions: [
          "Walk me through receiving a sample and finding it again six months later.",
          "Where do labels, inventories or storage maps disagree, and how do you resolve the discrepancy?",
        ],
      },
      {
        name: "Instruments, calibration & service",
        description: "The instrument checks and service history that distinguish reliable results from equipment trouble.",
        priority: 1,
        questions: [
          "Which instrument gives the earliest warning that results may be drifting, and what do you check?",
          "Tell me about an instrument failure that interrupted a study and how the work was recovered.",
        ],
      },
      {
        name: "Protocols, controls & reproducibility",
        description: "The recorded details and control checks a new researcher needs to repeat the lab's work reliably.",
        priority: 1,
        questions: [
          "Which step in a protocol needs more explanation than the written instructions currently give?",
          "When results disagree between researchers, how do you trace what changed and document the outcome?",
        ],
      },
      {
        name: "Lab safety & incident response",
        description: "How staff find approved safety procedures, recognise problems and get qualified help during an incident.",
        priority: 1,
        questions: [
          "What must a new colleague demonstrate before working independently, and who signs that off?",
          "When a freezer alarm or safety incident happens after hours, how does the response get coordinated?",
        ],
      },
      {
        name: "Reagents, suppliers & research records",
        description: "The supply dependencies and research records needed to keep experiments and project handovers on track.",
        priority: 2,
        questions: [
          "Which reagent or consumable needs ordering earlier than a new manager would expect, and why?",
          "Where are raw data, protocol versions and supplier lot records linked so another researcher can follow them?",
        ],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "payroll-finance",
    keywords: ["payroll", "finance", "accounting", "accounts", "ledger", "invoice", "tax", "benefits", "reconcil", "close", "ap ", "ar ", "treasury", "audit", "controller", "bookkeep"],
    domains: [
      {
        name: "Period close & reconciliation",
        description: "How the books actually get closed and what breaks.",
        priority: 1,
        questions: [
          "Walk me through your period close from the first day to sign-off.",
          "Where do the numbers most often disagree, and how do you find the difference?",
          "What do you check before you sign off that isn't in any checklist?",
        ],
      },
      {
        name: "Payments, files & banking",
        description: "Outbound money: files, cut-offs, rejections and reversals.",
        priority: 1,
        questions: [
          "Describe how a payment file gets built, approved and sent. Where can it fail?",
          "What happens when a file or payment is rejected — what do you do in the first hour?",
          "What are the real cut-off times versus the official ones?",
        ],
      },
      {
        name: "Compliance & regulatory filings",
        description: "Filings, notices and the penalties that lurk behind them.",
        priority: 1,
        questions: [
          "Which filings carry the biggest penalties if late, and how do you track them?",
          "Which regulator notices arrive unexpectedly and how do you respond?",
        ],
      },
      {
        name: "Exceptions & special cases",
        description: "Terminations, garnishments, off-cycle runs, multi-state, retro pay.",
        priority: 2,
        questions: [
          "What are the exceptions you handle by hand because the system can't?",
          "Tell me about the weirdest case you've handled and how you resolved it.",
        ],
      },
      {
        name: "Systems, reports & workarounds",
        description: "The tools, the exports, the macros and the manual patches.",
        priority: 2,
        questions: [
          "Which reports or spreadsheets exist only on your machine?",
          "What do you do in the system that isn't documented anywhere?",
        ],
      },
      {
        name: "Vendors & external partners",
        description: "Banks, benefits carriers, tax agencies, software vendors.",
        priority: 2,
        questions: [
          "Which vendor contact actually fixes things, and how do you reach them?",
          "Which vendor processes are slower than they claim?",
        ],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "engineering-ops",
    keywords: ["engineer", "sre", "devops", "infra", "platform", "backend", "deploy", "kubernetes", "database", "on-call", "oncall", "incident", "pipeline", "software", "developer", "architect", "cloud", "network", "security"],
    domains: [
      {
        name: "Architecture & why it's shaped this way",
        description: "The decisions behind the system, and which ones are load-bearing.",
        priority: 1,
        questions: [
          "Draw the system for me in words — what are the pieces and how do they talk?",
          "Which architectural decisions would you defend, and which would you undo?",
          "What is the most fragile part of the system and why hasn't it been fixed?",
        ],
      },
      {
        name: "Incidents & on-call playbooks",
        description: "The failures that recur and the moves that actually fix them.",
        priority: 1,
        questions: [
          "What pages you at 3am most often, and what do you do first?",
          "Which alerts are noise and which ones mean 'drop everything'?",
          "Tell me about the worst incident you handled and what you learned.",
        ],
      },
      {
        name: "Deploys, releases & rollbacks",
        description: "How code reaches production safely, and how to undo it.",
        priority: 1,
        questions: [
          "Walk me through a deploy end to end, including the parts that are manual.",
          "How do you roll back, and when does rollback not work?",
        ],
      },
      {
        name: "Data, migrations & backups",
        description: "Where the state lives and how to not lose it.",
        priority: 1,
        questions: [
          "How are backups taken, tested and restored? When did you last restore one?",
          "What migration went wrong, and what would you do differently?",
        ],
      },
      {
        name: "Access, secrets & vendors",
        description: "Credentials, accounts, and third-party dependencies.",
        priority: 2,
        questions: [
          "Which credentials or accounts are only held by you?",
          "Which vendors or external systems would break us if they changed?",
        ],
      },
      {
        name: "Tooling, scripts & tribal shortcuts",
        description: "Personal scripts, dashboards and undocumented commands.",
        priority: 2,
        questions: [
          "What scripts or dashboards live only on your laptop or in your head?",
          "What do you always type that a new engineer wouldn't know to type?",
        ],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "operations-manufacturing",
    keywords: ["operation", "plant", "manufactur", "maintenance", "machine", "line", "warehouse", "logistic", "supply", "shift", "safety", "technician", "field", "facility", "quality", "inspection", "equipment"],
    domains: [
      {
        name: "Equipment quirks & maintenance",
        description: "Every machine has a personality. This is where it's written down.",
        priority: 1,
        questions: [
          "Which machines have quirks that aren't in the manual, and what are they?",
          "What do you listen or look for that tells you something is about to fail?",
        ],
      },
      {
        name: "Safety & near-misses",
        description: "What has hurt people or nearly did, and the habits that prevent it.",
        priority: 1,
        questions: [
          "What near-misses have you seen, and what changed afterwards?",
          "Which safety rules exist because of a specific incident?",
        ],
      },
      {
        name: "Shift handover & daily rhythm",
        description: "How the day starts, hands over, and ends.",
        priority: 1,
        questions: [
          "Walk me through the first and last thirty minutes of your shift.",
          "What must be communicated at handover that usually isn't?",
        ],
      },
      {
        name: "Suppliers, parts & lead times",
        description: "Who supplies what, the real lead times, and the workarounds.",
        priority: 2,
        questions: [
          "Which parts take longer to get than anyone expects, and how do you plan around it?",
          "Which supplier contacts do you rely on personally?",
        ],
      },
      {
        name: "Quality & inspection judgement",
        description: "The calls you make by eye and experience.",
        priority: 2,
        questions: [
          "What do you reject that a checklist would pass, and why?",
          "How do you know a batch is good before the numbers come back?",
        ],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "sales-customer",
    keywords: ["sales", "account", "customer", "client", "revenue", "deal", "renewal", "support", "success", "partner", "relationship", "territory", "quota", "pipeline"],
    domains: [
      {
        name: "Key accounts & relationships",
        description: "Who the customers really are and what they care about.",
        priority: 1,
        questions: [
          "For your top accounts, who is the real decision maker and what do they care about?",
          "Which relationships are fragile right now, and why?",
        ],
      },
      {
        name: "Deal mechanics & pricing judgement",
        description: "How deals actually get done: discounts, approvals, timing.",
        priority: 1,
        questions: [
          "Walk me through how a deal moves from first call to signature.",
          "Which pricing or discount rules are unwritten but always applied?",
        ],
      },
      {
        name: "Objections & competitive intel",
        description: "What you hear, and what you say back.",
        priority: 2,
        questions: [
          "What objections come up most and how do you answer them?",
          "What do competitors say about us, and what's true?",
        ],
      },
      {
        name: "Renewals, churn signals & saves",
        description: "How you know a customer is leaving and how you keep them.",
        priority: 1,
        questions: [
          "What are the early signs a customer will churn?",
          "Tell me about a save — what worked?",
        ],
      },
      {
        name: "Tools, CRM hygiene & reporting",
        description: "Where the truth lives, and where it doesn't.",
        priority: 3,
        questions: ["Which fields in the CRM are reliable, and which are fiction?"],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "hr-people",
    keywords: ["hr", "people", "recruit", "talent", "onboarding", "hiring", "employee", "compensation", "culture", "learning", "training"],
    domains: [
      {
        name: "Policies & how they're really applied",
        description: "The written rules and the precedent that bends them.",
        priority: 1,
        questions: [
          "Which policies are applied with judgement, and what is the judgement?",
          "What precedent exists that isn't written anywhere?",
        ],
      },
      {
        name: "Sensitive cases & investigations",
        description: "How difficult situations have been handled well.",
        priority: 1,
        questions: ["Without names, what kinds of cases recur, and what have you learned about handling them?"],
      },
      {
        name: "Hiring & onboarding playbook",
        description: "How great people get in the door and up to speed.",
        priority: 2,
        questions: [
          "What does your hiring process look like when it works best?",
          "What do new hires consistently struggle with in month one?",
        ],
      },
      {
        name: "Vendors, systems & payroll interfaces",
        description: "Benefits carriers, HRIS, background checks, and the hand-offs.",
        priority: 2,
        questions: ["Which vendor or system hand-offs fail most often?"],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "clinical-care",
    keywords: ["nurse", "nursing", "clinical", "clinic", "hospital", "patient", "charge nurse", "physician", "pharmacy", "lab manager", "care team", "ward", "icu", "triage", "medical"],
    domains: [
      {
        name: "Patient-safety workarounds",
        description: "The checks and habits that keep patients safe when the system or the protocol falls short.",
        priority: 1,
        questions: [
          "What do you double-check by habit that the protocol doesn't require, and why?",
          "Tell me about a near-miss and what you changed afterwards.",
        ],
      },
      {
        name: "Escalation & who to call",
        description: "Which physician, pharmacist or department answers, and how fast.",
        priority: 1,
        questions: [
          "When a patient deteriorates at 3am, who do you call first and how do you reach them?",
          "Which departments are slow on paper but fast if you know the right person?",
        ],
      },
      {
        name: "Systems, orders & documentation",
        description: "The EHR, the order sets, the templates that actually get used.",
        priority: 1,
        questions: [
          "Which order sets or templates do you use that a new colleague wouldn't find?",
          "What do you do in the EHR that isn't in the training?",
        ],
      },
      {
        name: "Shift rhythm & handoff",
        description: "How the shift starts, hands over and ends without dropping anything.",
        priority: 1,
        questions: [
          "Walk me through the first and last thirty minutes of your shift.",
          "What must be said at handoff that usually isn't?",
        ],
      },
      {
        name: "Equipment & supplies",
        description: "The pump that beeps for no reason and the supply that runs out on Fridays.",
        priority: 2,
        questions: ["Which equipment has quirks that aren't in the manual?", "What runs out, and how do you get it when it does?"],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "oss-maintainer",
    keywords: ["maintainer", "open source", "open-source", "oss", "repository", "repo", "release", "npm", "pypi", "github", "community", "contributors", "library", "framework", "package"],
    domains: [
      {
        name: "Release process & rituals",
        description: "How a release actually goes out, and what's manual.",
        priority: 1,
        questions: [
          "Walk me through a release from tagging to announcement, including the parts done by hand.",
          "What has gone wrong in a release, and what checks came from it?",
        ],
      },
      {
        name: "Architecture & load-bearing decisions",
        description: "Why the code is shaped this way and what not to touch.",
        priority: 1,
        questions: [
          "Which parts of the codebase are fragile, and why haven't they been fixed?",
          "Which design decisions would you defend, and which would you undo?",
        ],
      },
      {
        name: "CI, tests & flaky things",
        description: "The tests nobody touches and the CI job that fails on Mondays.",
        priority: 1,
        questions: ["Which tests are flaky, why, and what do you do when they fail?", "What do you check before merging that CI doesn't?"],
      },
      {
        name: "Community, sponsors & access",
        description: "Who to trust, who pays the bills, and which accounts only you hold.",
        priority: 1,
        questions: [
          "Which accounts, tokens or publishing rights are held only by you?",
          "Who are the contributors and sponsors your successor should meet first, and how?",
        ],
      },
      {
        name: "Triage & support judgement",
        description: "How issues get prioritised and which requests to say no to.",
        priority: 2,
        questions: ["How do you decide what to fix, what to defer, and what to close?", "Which recurring requests do you decline, and why?"],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "founder-executive",
    keywords: ["founder", "ceo", "executive", "owner", "president", "managing director", "family business", "general manager", "chief", "succession", "board", "investor"],
    domains: [
      {
        name: "Key relationships",
        description: "Customers, partners, investors and regulators who trust a person, not a company.",
        priority: 1,
        questions: [
          "Which relationships are personal to you, and how should your successor be introduced?",
          "Who has been loyal in bad years, and what do they expect in return?",
        ],
      },
      {
        name: "Judgement calls & principles",
        description: "The decisions made on instinct and the principles behind them.",
        priority: 1,
        questions: [
          "What decisions do you make on judgement, and what do you weigh?",
          "Which offers or shortcuts have you refused, and why?",
        ],
      },
      {
        name: "Money, contracts & commitments",
        description: "The handshake deals, the pricing exceptions, the obligations not in any file.",
        priority: 1,
        questions: ["Which agreements or promises exist only in your head?", "Where does the business actually make and lose money?"],
      },
      {
        name: "Culture & the people",
        description: "Who really runs things, and how the place works when you're not there.",
        priority: 2,
        questions: ["Who are the people the company can't afford to lose, and what do they need?", "What unwritten rules define how things get done here?"],
      },
      ...COMMON_TAIL,
    ],
  },
  {
    key: "family-memory",
    keywords: ["grandmother", "grandfather", "grandma", "grandpa", "mother", "father", "family", "recipes", "recipe", "stories", "heritage", "memoir", "life story", "elder", "parent", "cooking"],
    domains: [
      {
        name: "Recipes & the way they're really made",
        description: "The measurements that live in the hand, not the book.",
        priority: 1,
        questions: [
          "Walk me through your most-requested dish, the way you actually make it.",
          "What do people get wrong when they try to copy it?",
        ],
      },
      {
        name: "Stories worth keeping",
        description: "The ones told at every gathering, and the ones never told.",
        priority: 1,
        questions: ["Tell me about the day that changed the family's path.", "What story do you want the grandchildren to hear from you, not from anyone else?"],
      },
      {
        name: "People & places",
        description: "Who is who, where they came from, and what they were like.",
        priority: 1,
        questions: ["Tell me about your parents as people, not as parents.", "Which places matter to the family, and why?"],
      },
      {
        name: "Rules of thumb & sayings",
        description: "The advice, the sayings, the small rules for a good life.",
        priority: 2,
        questions: ["What sayings did you grow up with, and which ones turned out to be true?", "What advice do you wish someone had given you at twenty?"],
      },
      {
        name: "Traditions & how to keep them",
        description: "Holidays, rituals, the things that must not be lost.",
        priority: 2,
        questions: ["How exactly is the holiday done, step by step, and who does what?"],
      },
    ],
  },
];

export const GENERIC_TEMPLATE: RoleTemplate = {
  key: "generic",
  keywords: [],
  domains: [
    {
      name: "Core responsibilities & workflows",
      description: "What the role actually does, step by step.",
      priority: 1,
      questions: [
        "Walk me through a typical week. What must happen, and in what order?",
        "Which task is the most consequential if done wrong?",
        "What do you do that nobody else knows how to do?",
      ],
    },
    {
      name: "Systems, tools & workarounds",
      description: "The tools, and the manual patches around them.",
      priority: 1,
      questions: [
        "Which systems do you use, and which ones do you fight with?",
        "What workarounds exist that a new person wouldn't guess?",
      ],
    },
    {
      name: "Decisions & judgement calls",
      description: "The choices that require experience rather than rules.",
      priority: 1,
      questions: [
        "What decisions do you make on judgement, and what do you weigh?",
        "When do you break the standard process, and why?",
      ],
    },
    {
      name: "Risks & failure modes",
      description: "What goes wrong, how you notice, and what you do.",
      priority: 2,
      questions: [
        "What goes wrong most often, and what are the early warning signs?",
        "What would embarrass the company if it slipped?",
      ],
    },
    ...COMMON_TAIL,
  ],
};

export function pickTemplate(role: string, context: string): RoleTemplate {
  const hay = `${role} ${context}`.toLowerCase();
  let best: { t: RoleTemplate; score: number } = { t: GENERIC_TEMPLATE, score: 0 };
  for (const t of ROLE_TEMPLATES) {
    let score = 0;
    for (const k of t.keywords) {
      const re = new RegExp(`\\b${k.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
      const matches = hay.match(re);
      if (matches) score += matches.length;
    }
    if (score > best.score) best = { t, score };
  }
  return best.t;
}

/** Well-known tools/systems used to spot "tool" atoms and derive system domains. */
export const KNOWN_TOOLS = [
  "Workday", "ADP", "SAP", "Oracle", "NetSuite", "QuickBooks", "Xero", "Excel", "Google Sheets", "Sheets",
  "Salesforce", "HubSpot", "Zendesk", "Jira", "Confluence", "Notion", "Slack", "Teams", "Outlook", "SharePoint",
  "ServiceNow", "Kubernetes", "Terraform", "Datadog", "Grafana", "PagerDuty", "Jenkins", "GitHub", "GitLab",
  "AWS", "Azure", "GCP", "Snowflake", "Postgres", "MySQL", "Redis", "Kafka", "Tableau", "Power BI", "Looker",
  "Paylocity", "Gusto", "Rippling", "Ceridian", "Dayforce", "UKG", "Kronos", "Concur", "Coupa", "Bill.com",
  "Stripe", "Shopify", "Twilio", "Okta", "Vault", "Splunk", "Ansible", "Airflow", "dbt", "Zapier", "macro", "VBA",
  "portal", "spreadsheet", "script", "dashboard", "ticket", "ERP", "CRM", "HRIS",
];
