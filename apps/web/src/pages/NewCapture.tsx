import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LANGUAGES } from "@tacit/core";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "../components/ui.js";
import { useApi, useApp } from "../lib/store.js";

const EXAMPLES = [
  {
    label: "Payroll lead",
    v: {
      name: "Maria Chen",
      role: "Senior Payroll Operations Specialist",
      team: "Finance Operations",
      tenure: "19",
      successor: "Jordan Reyes",
      successorRole: "Payroll Analyst",
      context:
        "Runs semi-monthly payroll for 1,400 US employees across six states on Workday, with ADP for tax filing and JPMorgan for ACH funding. Owns period-close reconciliation to NetSuite, garnishments, off-cycle runs and the annual W-2 process. Pain points: ACH rejections near cut-off, multi-state tax notices, a legacy Excel macro for the GL reconciliation.",
    },
  },
  {
    label: "Staff SRE",
    v: {
      name: "Dev Patel",
      role: "Staff Site Reliability Engineer",
      team: "Platform",
      tenure: "7",
      successor: "Ana Lima",
      successorRole: "SRE II",
      context:
        "Owns the Kubernetes platform on AWS (EKS), the Postgres fleet behind PgBouncer, the deploy pipeline in GitHub Actions and Argo CD, and on-call for the payments service. Fragile areas: the nightly ETL to Snowflake, a hand-rolled Terraform module for VPC peering, secrets in Vault.",
    },
  },
  {
    label: "Plant maintenance",
    v: {
      name: "Luis Ortega",
      role: "Lead Maintenance Technician",
      team: "Plant 2",
      tenure: "26",
      successor: "Sam Whitfield",
      successorRole: "Maintenance Technician II",
      context:
        "Keeps three packaging lines running: the 1998 Bosch filler, two Krones labelers and the shrink tunnel. Knows every machine's quirks, the suppliers who actually ship parts fast, and the safety rules that came from real incidents. Does the Monday shift handover and the quarterly preventive maintenance schedule.",
    },
  },
];

export function NewCapture() {
  const api = useApi();
  const toast = useApp((s) => s.toast);
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", role: "", team: "", tenure: "", departure: "", language: "en-US", successor: "", successorRole: "", context: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const defaultDeparture = () => {
    const d = new Date(Date.now() + 45 * 86400000);
    return d.toISOString().slice(0, 10);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.role.trim() || !f.context.trim()) {
      toast("Name, role and context are required", "error");
      return;
    }
    setBusy(true);
    try {
      const c = await api.createCapture({
        expert: {
          name: f.name.trim(),
          role: f.role.trim(),
          team: f.team.trim() || undefined,
          tenureYears: f.tenure ? Number(f.tenure) : undefined,
          departureDate: f.departure || defaultDeparture(),
          language: f.language || undefined,
        },
        successor: f.successor.trim() ? { name: f.successor.trim(), role: f.successorRole.trim() || undefined } : undefined,
        context: f.context.trim(),
      });
      toast(`Coverage map planned: ${c.domains.length} domains`, "success");
      nav(`/c/${c.id}`);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="New capture" title="Who is leaving, and what do they carry?" lede="Tacit plans a coverage map of knowledge domains from the role and context, then interviews the expert against it." />

      <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Try an example:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="rounded-full border border-line-2 bg-white/60 px-3 py-1 hover:border-ink/40"
            onClick={() => setF({ ...f, ...ex.v, departure: f.departure || defaultDeparture() })}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl">The expert</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input value={f.name} onChange={set("name")} placeholder="Maria Chen" required />
            </Field>
            <Field label="Role">
              <Input value={f.role} onChange={set("role")} placeholder="Senior Payroll Operations Specialist" required />
            </Field>
            <Field label="Team">
              <Input value={f.team} onChange={set("team")} placeholder="Finance Operations" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Years in role">
                <Input type="number" min={0} max={80} value={f.tenure} onChange={set("tenure")} placeholder="19" />
              </Field>
              <Field label="Last day">
                <Input type="date" value={f.departure} onChange={set("departure")} />
              </Field>
            </div>
            <Field label="Interview language" hint="The expert is interviewed in their language; the knowledge base is always written in English." className="md:col-span-2">
              <Select value={f.language} onChange={set("language")}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl">The successor</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" hint="Optional. Their unanswered questions will be queued for the expert.">
              <Input value={f.successor} onChange={set("successor")} placeholder="Jordan Reyes" />
            </Field>
            <Field label="Role">
              <Input value={f.successorRole} onChange={set("successorRole")} placeholder="Payroll Analyst" />
            </Field>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl">Context</h2>
          <Field label="What does this role own?" hint="Responsibilities, systems, recurring deadlines, known pain points. The more specific, the sharper the interview plan.">
            <Textarea value={f.context} onChange={set("context")} rows={6} placeholder="Runs semi-monthly payroll for 1,400 employees on Workday…" required />
          </Field>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => nav(-1)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={busy} icon={busy ? undefined : <Sparkles className="h-4 w-4" />}>
            {busy ? "Planning coverage map…" : "Plan the capture"}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
