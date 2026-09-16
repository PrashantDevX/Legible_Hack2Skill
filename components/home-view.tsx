"use client";

import { useState } from "react";
import { DEMOS } from "@/lib/demo";

/**
 * The problem-first home: describe a legal problem in plain words. Uploading
 * a document directly remains one click away — it is a sub-step of the same
 * product, not the whole product.
 */
export function HomeView({
  onNewCase,
  onOpenDocuments,
}: {
  onNewCase: (problem: string, demoId: string | null) => void;
  onOpenDocuments: () => void;
}) {
  const [problem, setProblem] = useState("");
  const trimmed = problem.trim();
  // Example answers are offered only for an unmodified demo problem.
  const activeDemo = DEMOS.find((d) => d.problem === problem) ?? null;

  return (
    <>
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Facing a legal problem? Start with plain words.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">
          Describe what&rsquo;s going on in your own words — no legal terms needed. Legible helps
          organize your situation, documents and evidence, identify information gaps, and prepare
          your next step.
        </p>
      </section>

      <section aria-label="Describe your situation" className="mt-8 rounded-xl border border-line bg-surface p-6">
        <label htmlFor="problem" className="block text-sm font-medium">
          What&rsquo;s happening?
        </label>
        <textarea
          id="problem"
          rows={4}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          maxLength={4000}
          placeholder="e.g. My landlord hasn't returned my security deposit…"
          className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNewCase(trimmed, activeDemo?.id ?? null)}
            disabled={trimmed.length < 20}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            Describe my situation
          </button>
          <button
            type="button"
            onClick={onOpenDocuments}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink"
          >
            I have a legal document
          </button>
        </div>
        {trimmed.length > 0 && trimmed.length < 20 && (
          <p className="mt-2 text-xs text-muted">
            A little more detail helps — {(20 - trimmed.length).toLocaleString()} more characters.
          </p>
        )}

        <p className="mt-5 text-xs text-muted">Or try an example:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMOS.map((demo) => (
            <button
              key={demo.id}
              type="button"
              aria-pressed={activeDemo?.id === demo.id}
              onClick={() => setProblem(demo.problem)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                activeDemo?.id === demo.id
                  ? "border-accent bg-accent text-on-accent"
                  : "border-line bg-surface text-ink"
              }`}
            >
              {demo.chip}
            </button>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-muted">
        Informational assistance only — Legible is not a lawyer and does not provide legal
        advice. Everything is analyzed in memory and kept only in this browser.
      </p>
    </>
  );
}
