"use client";

import { useState } from "react";
import type { VerifiedScenario } from "@/lib/schemas";
import { EvidenceBlock } from "./bits";

/** "What if?" explorer: one focused AI request per scenario, answered only
 *  from the document. Suggested scenarios come from the analysis itself. */

export function ScenarioPanel({
  documentText,
  examples,
}: {
  documentText: string;
  examples: string[];
}) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(VerifiedScenario & { asked: string }) | null>(null);

  async function explore(q: string) {
    if (q.trim().length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText, question: q, mode: "scenario" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not explore this scenario.");
      setResult({ ...data.answer, asked: q });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not explore this scenario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="scenario-heading" className="space-y-4">
      <h2 id="scenario-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
        Explore a scenario
      </h2>
      <p className="text-sm text-muted">
        What does this document say happens if something goes wrong or changes? Answers come only
        from the document.
      </p>

      {examples.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => explore(example)}
              disabled={busy}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {result && (
        <article aria-live="polite" className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <h3 className="font-semibold text-ink">{result.asked}</h3>
          {result.determinedFromDocument ? (
            <>
              <dl className="space-y-2 text-sm leading-relaxed">
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Trigger</dt>
                  <dd>{result.trigger}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Relevant clause</dt>
                  <dd>{result.relevantClause}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">What the document says happens</dt>
                  <dd>{result.whatHappens}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">What to verify</dt>
                  <dd>{result.whatToVerify}</dd>
                </div>
              </dl>
              <EvidenceBlock
                quote={result.source}
                verified={result.sourceVerified}
                page={result.page}
                label="Source"
              />
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed">{result.whatHappens}</p>
              <p className="rounded bg-soft px-3 py-2 text-xs text-muted">
                I can&rsquo;t determine that from this document alone. Consider asking a qualified
                legal professional.
              </p>
            </>
          )}
        </article>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          explore(question);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="scenario" className="sr-only">
          Describe a scenario
        </label>
        <input
          id="scenario"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What happens if I need to break the lease early?"
          maxLength={1000}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || question.trim().length < 3}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-50"
        >
          {busy ? "Checking…" : "Explore"}
        </button>
      </form>
      {error && (
        <p role="alert" className="rounded bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
