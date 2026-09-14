"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisView } from "@/components/analysis-view";
import { AskPanel } from "@/components/ask-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { SAMPLE_LEASE } from "@/lib/sample";
import type { VerifiedAnalysis } from "@/lib/schemas";
import { deleteDocument, listDocuments, saveDocument, type SavedDocument } from "@/lib/storage";

export default function Home() {
  const [docs, setDocs] = useState<SavedDocument[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDocs(listDocuments());
  }, []);

  const open = docs.find((doc) => doc.id === openId) ?? null;

  async function analyze(file: File | null, text: string) {
    setAnalyzing(true);
    setError(null);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      else form.set("text", text);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Analysis failed.");

      const entry: SavedDocument = {
        id: crypto.randomUUID(),
        name: file?.name ?? "Pasted document",
        documentType: data.analysis.documentType,
        savedAt: Date.now(),
        truncated: Boolean(data.truncated),
        docText: data.text,
        analysis: data.analysis as VerifiedAnalysis,
      };
      setDocs(saveDocument(entry));
      setPasted("");
      setOpenId(entry.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {open ? (
            <button
              onClick={() => setOpenId(null)}
              className="rounded-lg px-2 py-1 text-sm font-medium text-accent -ml-2"
            >
              ← All documents
            </button>
          ) : (
            <span className="text-base font-bold tracking-tight text-ink">Legible</span>
          )}
          <div className="flex items-center gap-2">
            {open && (
              <button
                onClick={() => {
                  setOpenId(null);
                  setMode("file");
                }}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink"
              >
                + New
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {!open ? (
          <>
            <section className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Understand any legal document before you sign it
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">
                Upload a lease, contract, or agreement. Get a plain-language brief: key clauses,
                what you&rsquo;re agreeing to, possible concerns, and questions to ask a lawyer —
                every finding traced back to your own document.
              </p>
            </section>

            <section
              aria-label="Provide a document"
              className="mt-8 rounded-xl border border-line bg-surface p-6"
            >
              <div className="mb-4 flex gap-2 text-sm" aria-label="Input method">
                <button
                  type="button"
                  aria-pressed={mode === "file"}
                  onClick={() => setMode("file")}
                  className={`rounded-lg px-3 py-1.5 font-medium ${mode === "file" ? "bg-accent text-on-accent" : "bg-soft text-muted"}`}
                >
                  Upload a file
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "text"}
                  onClick={() => setMode("text")}
                  className={`rounded-lg px-3 py-1.5 font-medium ${mode === "text" ? "bg-accent text-on-accent" : "bg-soft text-muted"}`}
                >
                  Paste text
                </button>
              </div>

              {mode === "file" ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) analyze(file, "");
                  }}
                  className={`rounded-lg border-2 border-dashed p-8 text-center ${dragging ? "border-accent bg-accent-soft" : "border-line"}`}
                >
                  <p className="text-sm">
                    Drag a document here, or{" "}
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="font-medium text-accent underline"
                    >
                      browse files
                    </button>
                    .
                  </p>
                  <p className="mt-1 text-xs text-muted">PDF, DOCX, or TXT — up to 5 MB</p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    className="sr-only"
                    aria-label="Choose a document file"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) analyze(file, "");
                      e.target.value = "";
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <label htmlFor="doc-text" className="block text-sm font-medium">
                    Paste the document text
                  </label>
                  <textarea
                    id="doc-text"
                    rows={8}
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder="Paste a lease, contract, terms of service…"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => analyze(null, pasted)}
                    disabled={pasted.trim().length < 200 || analyzing}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent disabled:opacity-50"
                  >
                    {analyzing ? "Reading the fine print…" : "Analyze document"}
                  </button>
                  {pasted.trim().length > 0 && pasted.trim().length < 200 && (
                    <p className="text-xs text-muted">
                      {(200 - pasted.trim().length).toLocaleString()} more characters needed.
                    </p>
                  )}
                </div>
              )}

              <p className="mt-4 text-center text-xs text-muted">
                First time here?{" "}
                <button
                  type="button"
                  className="font-medium text-accent underline"
                  onClick={() => {
                    setMode("text");
                    setPasted(SAMPLE_LEASE);
                  }}
                >
                  Load a sample lease
                </button>
              </p>

              {analyzing && (
                <p role="status" aria-live="polite" className="mt-4 text-center text-sm text-muted">
                  Reading the fine print… this usually takes under a minute.
                </p>
              )}
              {error && (
                <p role="alert" className="mt-4 rounded bg-danger-soft px-3 py-2 text-center text-sm text-danger">
                  {error}
                </p>
              )}
            </section>

            {docs.length > 0 && (
              <section aria-labelledby="history-heading" className="mt-10">
                <h2 id="history-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
                  Your documents ({docs.length})
                </h2>
                <ul className="mt-3 space-y-2">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-stretch gap-2">
                      <button
                        onClick={() => setOpenId(doc.id)}
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
                        onClick={() => setDocs(deleteDocument(doc.id))}
                        aria-label={`Delete ${doc.name} from history`}
                        title="Delete"
                        className="rounded-lg border border-line px-3 text-sm text-muted hover:text-danger"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="mt-8 text-center text-xs leading-relaxed text-muted">
              Informational assistance only — Legible is not a lawyer and does not provide legal
              advice. Documents are analyzed in memory and history is kept only in this browser.
            </p>
          </>
        ) : (
          <div className="space-y-10">
            <nav aria-label="Document" className="text-sm text-muted">
              <h1 className="text-xl font-bold text-ink">{open.name}</h1>
              <p className="mt-0.5">{open.documentType}</p>
            </nav>

            {open.truncated && (
              <p className="rounded bg-warn-soft px-3 py-2 text-sm text-warn">
                This document is long — the analysis covers the first ~120,000 characters.
              </p>
            )}

            <AnalysisView analysis={open.analysis} />
            <AskPanel documentText={open.docText} />

            <p className="rounded-lg border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
              <strong className="text-ink">Not legal advice.</strong> Legible provides
              informational assistance to help you read and understand documents. It does not
              replace advice from a qualified legal professional, and it may miss issues or
              misread passages. Always consult a licensed professional before making legal
              decisions. This document is stored only in your browser — delete it anytime from
              the documents list.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
