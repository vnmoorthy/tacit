import { Check, Copy, Download, Printer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Markdown } from "../components/Markdown.js";
import { Button, Card, EmptyState, PageHeader } from "../components/ui.js";
import { useApi, useApp } from "../lib/store.js";

export function Handover() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useApp((s) => s.toast);
  const [md, setMd] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMd(null);
    setError(null);
    try { setMd(await api.handover(id)); }
    catch (e) { setError((e as Error).message); }
  }, [api, id]);
  useEffect(() => { void load(); }, [load]);

  const copy = async () => {
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      toast("Handover copied", "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Clipboard access is unavailable. Download the Markdown file instead.", "error");
    }
  };

  const download = () => {
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tacit-handover-${id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        className="no-print"
        eyebrow="Handover document"
        title="Compiled from everything captured"
        lede="Compiled from the knowledge base when you open this page. Copy it into your documentation tool, or print it to PDF."
        actions={
          <>
            <Button disabled={!md} onClick={copy} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
              {copied ? "Copied" : "Copy Markdown"}
            </Button>
            <Button disabled={!md} onClick={download} icon={<Download className="h-4 w-4" />}>
              Download .md
            </Button>
            <Button disabled={!md} variant="primary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>
              Print or save PDF
            </Button>
          </>
        }
      />
      <Card className="px-8 py-8 md:px-12 md:py-10 bg-paper-2">
        {error ? <EmptyState title="Handover couldn't load" body={error} action={<Button onClick={() => void load()}>Try again</Button>} /> : md === null ? <div role="status" aria-label="Compiling handover" className="h-96 animate-pulse rounded-xl bg-paper-3" /> : <Markdown>{md}</Markdown>}
      </Card>
    </div>
  );
}
