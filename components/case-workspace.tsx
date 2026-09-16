"use client";

import { useState } from "react";
import type { CaseBrief, VerifiedAnalysis } from "@/lib/schemas";
import type { SavedCase } from "@/lib/case-storage";
import { caseDocuments, saveCase } from "@/lib/case-storage";
import type { SavedDocument } from "@/lib/storage";
import { deleteDocument, listDocuments, saveDocument } from "@/lib/storage";
import { caseReadiness } from "@/lib/readiness";
import { DEMOS } from "@/lib/demo";
import { CollapsibleSection, EvidenceBlock, Section, SeverityChip } from "./bits";
import { GapsSection, NextStepsSection, SituationSection, TimelineSection } from "./case-brief-view";
import { DraftPanel } from "./draft-panel";
import { LawyerBrief } from "./lawyer-brief";
import { ScenarioPanel } from "./scenario-panel";
import { UploadBox } from "./upload-box";

/** A compact summary of one document's findings, sent to the case-brief call
 *  so document facts can be merged into the brief with source "document". */
function documentFindingsSummary(doc: SavedDocument): string {
  const a = doc.analysis;
  const parts = [`${doc.name} (${a.documentType}):`];
  a.concerns.slice(0, 3).forEach((c) => parts.push(`- concern [${c.severity}]: ${c.title} — "${c.quote}"`));
  (a.missingInformation ?? []).slice(0, 3).forEach((m) => parts.push(`- missing/incomplete: ${m.item}`));
  (a.partyAsymmetries ?? []).forEach((s) =>
    parts.push(`- party difference (${s.topic}): ${s.partyAPosition} vs ${s.partyBPosition}`),
  );
  return parts.join("\n").slice(0, 4000);
}

/** Local-storage mutations run in event handlers, never during render — kept
 *  as module-level helpers so the component body stays pure. */
function unlinkDocument(c: SavedCase, id: string): SavedCase {
  return { ...c, documentIds: c.documentIds.filter((d) => d !== id), updatedAt: Date.now() };
}

function withDraft(
  c: SavedCase,
  draftType: SavedCase["draftType"],
  draft: NonNullable<SavedCase["draft"]>,
): SavedCase {
  return { ...c, draftType, draft, updatedAt: Date.now() };
}

/**
 * The case workspace: everything about one legal problem in one place —
 * brief, timeline, evidence, information gaps, focused document findings,
 * scenarios, drafts, and the consultation brief.
 */
export function CaseWorkspace({
  caseData,
  allDocs,
  onChanged,
  onOpenDocument,
}: {
  caseData: SavedCase;
  allDocs: SavedDocument[];
  onChanged: () => void;
  onOpenDocument: (docId: string) => void;
}) {
  const docs = caseDocuments(caseData, allDocs);
  const readiness = caseReadiness(caseData, docs.length);
  const answered = caseData.intake.filter((a) => a.answer.trim().length > 0);

  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [scenarioDocId, setScenarioDocId] = useState<string | null>(docs[0]?.id ?? null);

  const samples = DEMOS.map((d) => d.sample);

  async function addDocument(file: File | null, text: string, name?: string) {
    if (adding) return;
    setAdding(true);
    setAddError(null);
    try {
      // 1. Analyze the document, focused on this case's problem.
      const form = new FormData();
      if (file) form.set("file", file);
      else form.set("text", text);
      form.set("situation", caseData.problem);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Analysis failed.");

      // 2. Save the document, link it to the case.
      const entry: SavedDocument = {
        id: crypto.randomUUID(),
        name: file?.name ?? name ?? "Pasted document",
        documentType: data.analysis.documentType,
        savedAt: Date.now(),
        truncated: Boolean(data.truncated),
        docText: data.text,
        analysis: data.analysis,
      };
      saveDocument(entry);
      const linked: SavedCase = {
        ...caseData,
        documentIds: [...caseData.documentIds, entry.id],
        updatedAt: Date.now(),
      };
      saveCase(linked);
      setScenarioDocId((current) => current ?? entry.id);

      // 3. Refresh the brief so document facts join the case (one focused call).
      setRefreshing(true);
      const findings = caseDocuments(linked, listDocuments()).map(documentFindingsSummary);
      const briefResponse = await fetch("/api/case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "brief",
          problem: caseData.problem,
          answers: answered,
          documentFindings: findings,
        }),
      });
      const briefData = await briefResponse.json();
      if (briefResponse.ok) {
        saveCase({ ...linked, brief: briefData.brief as CaseBrief, updatedAt: Date.now() });
      }
      // A failed refresh keeps the existing brief — the document is still linked.
      onChanged();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAdding(false);
      setRefreshing(false);
    }
  }

  function removeDocument(id: string) {
    // Unlink from the case; the document itself stays in the document history.
    saveCase(unlinkDocument(caseData, id));
    if (scenarioDocId === id) setScenarioDocId(caseData.documentIds.find((d) => d !== id) ?? null);
    onChanged();
  }

  function saveDraft(draftType: SavedCase["draftType"], draft: NonNullable<SavedCase["draft"]>) {
    saveCase(withDraft(caseData, draftType, draft));
    onChanged();
  }

  function deleteCaseDoc(id: string) {
    deleteDocument(id);
    removeDocument(id);
  }

  const scenarioDoc = docs.find((d) => d.id === scenarioDocId) ?? docs[0];

  return (
    <div className="space-y-10">
      {/* Case header: the problem, in the person's own words */}
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Your case</p>
        <h1 className="text-xl font-bold leading-snug text-ink">{caseData.problem}</h1>
        <p className="text-xs text-muted">
          Started {new Date(caseData.createdAt).toLocaleDateString()} ·{" "}
          {docs.length} document{docs.length === 1 ? "" : "s"}
        </p>
      </header>

      {/* Case readiness — preparation completeness, never a legal-outcome score */}
      <section aria-labelledby="readiness-heading" className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="readiness-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
            Case readiness
          </h2>
          <p className="text-2xl font-bold text-accent">{readiness.percent}%</p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={readiness.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Preparation completeness"
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-soft"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${readiness.percent}%` }} />
        </div>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {readiness.items.map((item) => (
            <li key={item.label} className="text-sm">
              <span aria-hidden className={item.done ? "text-ok" : "text-warn"}>
                {item.done ? "✓" : "⚠"}
              </span>{" "}
              <span className={item.done ? "text-ink" : "text-muted"}>{item.label}</span>
              <span className="sr-only">{item.done ? " (done)" : " (not yet)"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Preparation completeness — not an assessment of legal outcome or strength.
        </p>
      </section>

      <SituationSection brief={caseData.brief} />

      <CollapsibleSection title="What you told us" count={caseData.intake.length}>
        {caseData.intake.length === 0 ? (
          <p className="text-sm text-muted">No clarifying questions were needed.</p>
        ) : (
          <dl className="space-y-3">
            {caseData.intake.map((item, i) => (
              <div key={i} className="rounded-lg bg-soft px-3 py-2">
                <dt className="text-xs text-muted">{item.question}</dt>
                <dd className="mt-0.5 text-sm">{item.answer.trim() || <span className="text-muted">Not answered</span>}</dd>
              </div>
            ))}
          </dl>
        )}
      </CollapsibleSection>

      <TimelineSection brief={caseData.brief} />

      {/* Evidence: connected documents, not independent uploads */}
      <Section title="Evidence">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-ok uppercase">Available</h3>
              {docs.length === 0 ? (
                <p className="mt-1 text-sm text-muted">No documents attached yet.</p>
              ) : (
                <ul className="mt-1 space-y-2">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface p-3">
                      <span className="text-sm" aria-hidden>✓</span>
                      <button
                        type="button"
                        onClick={() => onOpenDocument(doc.id)}
                        className="flex-1 text-left text-sm font-medium text-accent underline"
                      >
                        {doc.name}
                      </button>
                      <span className="text-xs text-muted">{doc.documentType}</span>
                      <button
                        type="button"
                        onClick={() => removeDocument(doc.id)}
                        aria-label={`Remove ${doc.name} from this case`}
                        title="Remove from this case"
                        className="rounded px-2 text-sm text-muted hover:text-danger"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-warn uppercase">May help to collect</h3>
              {caseData.brief.informationGaps.length === 0 ? (
                <p className="mt-1 text-sm text-muted">Nothing specific right now.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {caseData.brief.informationGaps.map((gap, i) => (
                    <li key={i} className="text-sm text-muted">
                      ⚠ {gap.gap}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <UploadBox busy={adding} onAnalyze={addDocument} samples={samples} />
          {(adding || refreshing) && (
            <p role="status" aria-live="polite" className="text-sm text-muted">
              {adding && "Reading the document against your situation…"}
              {adding && refreshing && " "}
              {refreshing && "Updating your case brief with what the document says…"}
            </p>
          )}
          {addError && (
            <p role="alert" className="rounded bg-danger-soft px-3 py-2 text-sm text-danger">
              {addError}
            </p>
          )}
        </div>
      </Section>

      <GapsSection brief={caseData.brief} />

      {/* Focused document findings — the V1 analysis, prioritized for this problem */}
      <Section title="What your documents say" count={docs.length}>
        {docs.length === 0 ? (
          <p className="text-sm text-muted">
            Attach a document above and Legible will analyze it with your situation in mind —
            key clauses, concerns, missing information, and party differences, each traced to a
            quote.
          </p>
        ) : (
          <div className="space-y-6">
            {docs.map((doc) => (
              <DocFindings
                key={doc.id}
                doc={doc}
                onOpen={() => onOpenDocument(doc.id)}
                onDelete={() => deleteCaseDoc(doc.id)}
              />
            ))}
          </div>
        )}
      </Section>

      <NextStepsSection brief={caseData.brief} />

      {docs.length > 0 && scenarioDoc && (
        <section aria-labelledby="case-scenario-heading" className="space-y-3">
          <h2 id="case-scenario-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
            Explore a scenario
          </h2>
          {docs.length > 1 && (
            <label className="flex flex-wrap items-center gap-2 text-xs text-muted">
              Using
              <select
                value={scenarioDoc.id}
                onChange={(e) => setScenarioDocId(e.target.value)}
                className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink"
              >
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ScenarioPanel
            documentText={scenarioDoc.docText}
            examples={scenarioDoc.analysis.suggestedScenarios ?? []}
            situation={caseData.problem}
          />
        </section>
      )}

      <DraftPanel
        problem={caseData.problem}
        answers={answered}
        documentText={docs[0]?.docText}
        draft={caseData.draft}
        onSaved={saveDraft}
      />

      <LawyerBrief caseData={caseData} docs={docs} />

      <p className="rounded-lg border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
        <strong className="text-ink">Not legal advice.</strong> Legible provides informational
        assistance to help you understand, organize, and prepare. It does not replace advice from
        a qualified legal professional, and it may miss issues or misread passages. Facts marked{" "}
        <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-warn">AI interpretation</span>{" "}
        are automated summaries and should be verified. This case is stored only in your browser.
      </p>
    </div>
  );
}

/** Focused findings for one attached document: the most relevant concerns with
 *  their verified evidence, plus counts of missing info and imbalances. */
function DocFindings({
  doc,
  onOpen,
  onDelete,
}: {
  doc: SavedDocument;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const a: VerifiedAnalysis = doc.analysis;
  const missing = a.missingInformation ?? [];
  const asymmetries = a.partyAsymmetries ?? [];
  const top = a.concerns.slice(0, 3);

  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-ink">{doc.name}</h3>
          <p className="text-xs text-muted">{a.documentType}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-accent"
          >
            Open full analysis
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${doc.name} permanently`}
            title="Delete permanently"
            className="rounded-lg border border-line px-2.5 py-1.5 text-sm text-muted hover:text-danger"
          >
            ✕
          </button>
        </div>
      </div>

      {doc.truncated && (
        <p className="mt-2 rounded bg-warn-soft px-3 py-2 text-xs text-warn">
          Long document — analysis covers the first ~120,000 characters.
        </p>
      )}

      {top.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {top.map((concern, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{concern.title}</p>
                <SeverityChip severity={concern.severity} />
              </div>
              <p className="mt-0.5 text-sm leading-relaxed">{concern.whyItMatters}</p>
              <EvidenceBlock
                quote={concern.quote}
                verified={a.quotesVerified.concerns[a.concerns.indexOf(concern)]}
                page={a.pages?.concerns?.[a.concerns.indexOf(concern)]}
                location={concern.location}
                label="Source"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No significant concerns identified in this document.</p>
      )}

      {(missing.length > 0 || asymmetries.length > 0) && (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {missing.length > 0 && (
            <li>
              ⚠ {missing.length} missing or incomplete item{missing.length === 1 ? "" : "s"} (see full analysis)
            </li>
          )}
          {asymmetries.length > 0 && (
            <li>⚖ {asymmetries.length} potential party imbalance{asymmetries.length === 1 ? "" : "s"}</li>
          )}
        </ul>
      )}
    </article>
  );
}
