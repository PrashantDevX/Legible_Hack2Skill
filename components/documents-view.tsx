"use client";

import { useState } from "react";
import type { SavedDocument } from "@/lib/storage";
import { saveDocument } from "@/lib/storage";
import { SAMPLE_LEASE } from "@/lib/sample";
import { UploadBox } from "./upload-box";

/** The V1 document workflow, unchanged: upload or paste, analyze, keep. */
export function DocumentsView({
  docs,
  onAnalyzed,
  onOpen,
  onDelete,
}: {
  docs: SavedDocument[];
  onAnalyzed: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(file: File | null, text: string, name?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      else form.set("text", text);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Analysis failed.");
      saveDocument({
        id: crypto.randomUUID(),
        name: file?.name ?? name ?? "Pasted document",
        documentType: data.analysis.documentType,
        savedAt: Date.now(),
        truncated: Boolean(data.truncated),
        docText: data.text,
        analysis: data.analysis,
      });
      onAnalyzed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="documents-heading" className="space-y-6">
      <h1 id="documents-heading" className="text-xl font-bold text-ink">
        Documents
      </h1>
      <UploadBox
        busy={busy}
        onAnalyze={analyze}
        samples={[{ label: "Sample rental agreement", name: "Rental agreement.pdf", text: SAMPLE_LEASE }]}
      />
      {busy && (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          Reading the fine print… this usually takes under a minute.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {docs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Analyzed documents ({docs.length})
          </h2>
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-stretch gap-2">
                <button
                  onClick={() => onOpen(doc.id)}
                  className="flex-1 rounded-lg border border-line bg-surface p-4 text-left"
                >
                  <span className="block font-medium text-ink">{doc.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {doc.documentType} · {new Date(doc.savedAt).toLocaleDateString()} ·{" "}
                    {doc.analysis.concerns.length} concern
                    {doc.analysis.concerns.length === 1 ? "" : "s"}
                  </span>
                </button>
                <button
                  onClick={() => onDelete(doc.id)}
                  aria-label={`Delete ${doc.name} from history`}
                  title="Delete"
                  className="rounded-lg border border-line px-3 text-sm text-muted hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
