import { Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Atom, AtomType, Capture } from "@tacit/core";
import { ATOM_TYPES } from "@tacit/core";
import { ATOM_META, AtomCard } from "../components/AtomCard.js";
import { Button, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, Toggle, cx } from "../components/ui.js";
import { useApi, useApp } from "../lib/store.js";

export function Knowledge() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useApp((s) => s.toast);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<AtomType | "">("");
  const [domainId, setDomainId] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [editing, setEditing] = useState<Atom | null>(null);
  const [deleting, setDeleting] = useState<Atom | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "", type: "rule" as AtomType, tags: "", domainId: "" });

  const load = useCallback(async () => {
    const [c, a] = await Promise.all([api.getCapture(id), api.listAtoms(id, { q: q || undefined, type: type || undefined, domainId: domainId || undefined, verified: verifiedOnly ? true : undefined })]);
    setCapture(c);
    setAtoms(a);
  }, [api, id, q, type, domainId, verifiedOnly]);

  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => toast((e as Error).message, "error")), q ? 220 : 0);
    return () => clearTimeout(t);
  }, [load, q, toast]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of atoms) m[a.type] = (m[a.type] ?? 0) + 1;
    return m;
  }, [atoms]);

  const domainName = (did?: string) => capture?.domains.find((d) => d.id === did)?.name;

  const verify = async (a: Atom, verified: boolean) => {
    try {
      await api.updateAtom(a.id, { verified });
      toast(verified ? "Marked as verified by the expert" : "Verification removed");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const openEdit = (a: Atom) => {
    setEditing(a);
    setDraft({ title: a.title, content: a.content, type: a.type, tags: a.tags.join(", "), domainId: a.domainId ?? "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.updateAtom(editing.id, {
        title: draft.title.trim(),
        content: draft.content.trim(),
        type: draft.type,
        tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
        domainId: draft.domainId || undefined,
      });
      setEditing(null);
      toast("Atom updated", "success");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteAtom(deleting.id);
      setDeleting(null);
      toast("Atom deleted");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge base"
        title={
          <>
            {capture ? `What ${capture.expert.name.split(" ")[0]} knows` : "Knowledge"}
            <span className="ml-3 align-middle font-mono text-[15px] text-muted">{atoms.length} atoms</span>
          </>
        }
        lede="Every atom is cited to the expert's own words. Verify what's right, fix what isn't, delete what's noise."
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search procedures, gotchas, people, tools…" className="pl-9" />
        </div>
        <Select value={domainId} onChange={(e) => setDomainId(e.target.value)} className="md:w-64">
          <option value="">All domains</option>
          {capture?.domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Toggle checked={verifiedOnly} onChange={setVerifiedOnly} label="Verified only" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setType("")} className={cx("rounded-full border px-3 py-1 text-[12.5px]", !type ? "bg-ink text-paper border-ink" : "border-line-2 bg-white/60 hover:border-ink/40")}>
          All
        </button>
        {ATOM_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(type === t ? "" : t)}
            className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px]", type === t ? "bg-ink text-paper border-ink" : "border-line-2 bg-white/60 hover:border-ink/40")}
          >
            {ATOM_META[t].icon}
            {ATOM_META[t].label}
            {counts[t] ? <span className="font-mono text-[10.5px] opacity-70">{counts[t]}</span> : null}
          </button>
        ))}
      </div>

      {atoms.length === 0 ? (
        <EmptyState title="No atoms match" body={q ? "Try different words — search is semantic-ish, not exact." : "Run an interview to start capturing knowledge."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {atoms.map((a) => (
            <AtomCard key={a.id} atom={a} domainName={domainName(a.domainId)} onVerify={verify} onEdit={openEdit} onDelete={setDeleting} />
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit atom"
        wide
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveEdit}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type">
              <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as AtomType })}>
                {ATOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ATOM_META[t].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Domain">
              <Select value={draft.domainId} onChange={(e) => setDraft({ ...draft, domainId: e.target.value })}>
                <option value="">Unassigned</option>
                {capture?.domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Title">
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label="Content (markdown)">
            <Textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={7} />
          </Field>
          <Field label="Tags" hint="Comma separated">
            <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this atom?"
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={doDelete} icon={<Trash2 className="h-4 w-4" />}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">“{deleting?.title}” will be removed from the knowledge base and the handover document.</p>
      </Modal>
    </div>
  );
}
