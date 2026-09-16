"use client";

import type { SavedCase } from "@/lib/case-storage";
import { caseReadiness } from "@/lib/readiness";

/** Saved cases, newest first — the person's ongoing legal problems. */
export function CasesView({
  cases,
  onOpen,
  onDelete,
  onNewCase,
}: {
  cases: SavedCase[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNewCase: () => void;
}) {
  if (cases.length === 0) {
    return (
      <section className="rounded-xl border border-line bg-surface p-8 text-center">
        <h1 className="text-xl font-bold text-ink">No cases yet</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Describe a legal problem in your own words and Legible will help you organize it —
          facts, timeline, evidence, and what to prepare next.
        </p>
        <button
          type="button"
          onClick={onNewCase}
          className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent"
        >
          Describe my situation
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="cases-heading" className="space-y-3">
      <h1 id="cases-heading" className="text-xl font-bold text-ink">
        My cases
      </h1>
      <ul className="space-y-2">
        {cases.map((c) => {
          const readiness = caseReadiness(c, c.documentIds.length);
          return (
            <li key={c.id} className="flex items-stretch gap-2">
              <button
                onClick={() => onOpen(c.id)}
                className="flex-1 rounded-lg border border-line bg-surface p-4 text-left"
              >
                <span className="block font-medium text-ink">{c.problem}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Updated {new Date(c.updatedAt).toLocaleDateString()} ·{" "}
                  {c.documentIds.length} document{c.documentIds.length === 1 ? "" : "s"} ·{" "}
                  {readiness.percent}% prepared
                </span>
              </button>
              <button
                onClick={() => onDelete(c.id)}
                aria-label={`Delete case: ${c.problem.slice(0, 40)}`}
                title="Delete"
                className="rounded-lg border border-line px-3 text-sm text-muted hover:text-danger"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
