"use client";

import type { SavedDocument } from "@/lib/storage";
import { AnalysisView } from "./analysis-view";
import { AskPanel } from "./ask-panel";
import { ScenarioPanel } from "./scenario-panel";

/** One analyzed document: the full V1 brief plus grounded Q&A and scenarios.
 *  When opened from a case, the case's problem is passed as context. */
export function DocumentView({
  doc,
  situation,
}: {
  doc: SavedDocument;
  situation?: string;
}) {
  return (
    <div className="space-y-10">
      <nav aria-label="Document" className="text-sm text-muted">
        <h1 className="text-xl font-bold text-ink">{doc.name}</h1>
        <p className="mt-0.5">{doc.documentType}</p>
      </nav>

      {doc.truncated && (
        <p className="rounded bg-warn-soft px-3 py-2 text-sm text-warn">
          This document is long — the analysis covers the first ~120,000 characters.
        </p>
      )}

      <AnalysisView analysis={doc.analysis} />
      <AskPanel documentText={doc.docText} situation={situation} />
      <ScenarioPanel
        documentText={doc.docText}
        examples={doc.analysis.suggestedScenarios ?? []}
        situation={situation}
      />

      <p className="rounded-lg border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
        <strong className="text-ink">Not legal advice.</strong> Legible provides informational
        assistance to help you read and understand documents. It does not replace advice from a
        qualified legal professional, and it may miss issues or misread passages. This document
        is stored only in your browser — delete it anytime from the documents list.
      </p>
    </div>
  );
}
