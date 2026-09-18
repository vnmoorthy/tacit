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
