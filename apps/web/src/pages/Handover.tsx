import { Check, Copy, Download, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Markdown } from "../components/Markdown.js";
import { Button, Card, PageHeader } from "../components/ui.js";
import { useApi, useApp } from "../lib/store.js";

export function Handover() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useApp((s) => s.toast);
  const [md, setMd] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .handover(id)
      .then(setMd)
      .catch((e) => toast((e as Error).message, "error"));
  }, [api, id, toast]);

  const copy = async () => {
    if (!md) return;
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        lede="Regenerated live from the knowledge base. Paste into Confluence, Notion, or print to PDF."
        actions={
          <>
            <Button onClick={copy} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
              {copied ? "Copied" : "Copy markdown"}
            </Button>
            <Button onClick={download} icon={<Download className="h-4 w-4" />}>
              Download .md
            </Button>
            <Button variant="primary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>
              Print / PDF
            </Button>
          </>
        }
      />
      <Card className="px-8 py-8 md:px-12 md:py-10 bg-paper-2">
        {md === null ? <div className="h-96 animate-pulse rounded-xl bg-paper-2" /> : <Markdown>{md}</Markdown>}
      </Card>
    </div>
  );
}
