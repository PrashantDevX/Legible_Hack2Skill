"use client";

import { useState } from "react";
import type { SavedCase } from "@/lib/case-storage";
import type { SavedDocument } from "@/lib/storage";
import { buildLawyerBriefText } from "@/lib/lawyer-brief";
import { Section } from "./bits";

/**
 * Consultation-ready brief — composed deterministically from the case data
 * (no AI call), so every line traces to something already reviewed. Copy it,
 * print it, or bring it to a professional.
 */
export function LawyerBrief({ caseData, docs }: { caseData: SavedCase; docs: SavedDocument[] }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = buildLawyerBriefText(caseData, docs);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying was blocked by the browser — select the text and copy manually.");
    }
  }

  return (
    <Section title="Prepare for a professional consultation">
      <p className="text-sm text-muted">
        Everything about your situation in one page — so you can explain it to a qualified
        professional in two minutes. Composed from your case data only; no new AI output.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent"
        >
          {copied ? "✓ Copied" : "Copy brief"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium"
        >
          Print / Save
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div
        id="lawyer-brief-print"
        className="whitespace-pre-wrap rounded-lg border border-line bg-surface p-4 text-xs leading-relaxed text-ink print:border-0 print:text-sm"
      >
        {text}
      </div>
    </Section>
  );
}
