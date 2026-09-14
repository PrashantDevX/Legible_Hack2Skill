"use client";

import { useRef, useState } from "react";
import { AnalysisView } from "@/components/analysis-view";
import { AskPanel } from "@/components/ask-panel";
import { SAMPLE_LEASE } from "@/lib/sample";
import type { VerifiedAnalysis } from "@/lib/schemas";

type Phase = "idle" | "analyzing" | "done";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [docText, setDocText] = useState("");
  const [analysis, setAnalysis] = useState<VerifiedAnalysis | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function analyze(file: File | null, text: string) {
    setPhase("analyzing");
    setError(null);
    setAnalysis(null);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      else form.set("text", text);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Analysis failed.");
      setAnalysis(data.analysis);
      setDocText(data.text);
      setTruncated(Boolean(data.truncated));
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setPhase("idle");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <header className={phase === "done" ? "sr-only" : "text-center"}>
        <h1 className="text-4xl font-bold tracking-tight text-ink">Legible</h1>
        <p className="mt-3 text-lg">Understand any legal document before you sign it.</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Upload a lease, employment contract, or agreement. Get a plain-language brief:
          key clauses, what you&rsquo;re agreeing to, possible concerns, and questions to ask a
          lawyer — with every finding traced back to your own document.
        </p>
      </header>

      {phase !== "done" && (
        <section
          aria-label="Provide a document"
          className="mt-10 rounded-xl border border-line bg-white p-6"
        >
          <div role="tablist" aria-label="Input method" className="mb-4 flex gap-2 text-sm">
            <button
              role="tab"
              aria-selected={mode === "file"}
              onClick={() => setMode("file")}
              className={`rounded-lg px-3 py-1.5 font-medium ${mode === "file" ? "bg-accent text-white" : "bg-slate-100 text-slate-700"}`}
            >
              Upload a file
            </button>
            <button
              role="tab"
              aria-selected={mode === "text"}
              onClick={() => setMode("text")}
              className={`rounded-lg px-3 py-1.5 font-medium ${mode === "text" ? "bg-accent text-white" : "bg-slate-100 text-slate-700"}`}
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
                if (file) {
                  setFileName(file.name);
                  analyze(file, "");
                }
              }}
              className={`rounded-lg border-2 border-dashed p-8 text-center ${dragging ? "border-accent bg-blue-50" : "border-line"}`}
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
                  if (file) {
                    setFileName(file.name);
                    analyze(file, "");
                  }
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
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
              <button
                onClick={() => analyze(null, pasted)}
                disabled={pasted.trim().length < 200 || phase === "analyzing"}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {phase === "analyzing" ? "Reading the fine print…" : "Analyze document"}
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

          {phase === "analyzing" && (
            <p role="status" aria-live="polite" className="mt-4 text-center text-sm text-muted">
              Reading the fine print… this usually takes under a minute.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-center text-sm text-red-800">
              {error}
            </p>
          )}
        </section>
      )}

      {phase === "done" && analysis && (
        <div className="space-y-10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted">
              {fileName ? (
                <>Analyzed: <span className="font-medium text-ink">{fileName}</span></>
              ) : (
                "Analyzed your document"
              )}
            </p>
            <button
              onClick={() => {
                setPhase("idle");
                setAnalysis(null);
                setFileName(null);
                setPasted("");
                setError(null);
              }}
              className="rounded-lg border border-line px-3 py-1.5 font-medium"
            >
              Analyze another document
            </button>
          </div>
          {truncated && (
            <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This document is long — the analysis covers the first ~120,000 characters.
            </p>
          )}
          <AnalysisView analysis={analysis} />
          <AskPanel documentText={docText} />
          <p className="rounded-lg border border-line bg-white p-4 text-xs leading-relaxed text-muted">
            <strong className="text-ink">Not legal advice.</strong> Legible provides
            informational assistance to help you read and understand documents. It does not
            replace advice from a qualified legal professional, and it may miss issues or
            misread passages. Always consult a licensed professional before making legal
            decisions. Your document is analyzed in memory and is not stored.
          </p>
        </div>
      )}

      {phase !== "done" && (
        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          Informational assistance only — Legible is not a lawyer and does not provide legal
          advice. Documents are analyzed in memory and never stored.
        </p>
      )}
    </main>
  );
}
