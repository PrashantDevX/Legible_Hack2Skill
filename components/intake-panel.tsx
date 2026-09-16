"use client";

import { useEffect, useRef, useState } from "react";
import type { IntakeQuestions } from "@/lib/schemas";
import type { SavedCase } from "@/lib/case-storage";
import { saveCase } from "@/lib/case-storage";
import type { Demo } from "@/lib/demo";

/**
 * Smart intake: fetch 3-5 clarifying questions generated from the person's
 * problem description, collect answers, then build the case brief. The case
 * is created (and persisted) only once the brief is ready.
 */
export function IntakePanel({
  problem,
  demo,
  onCreated,
  onCancel,
}: {
  problem: string;
  demo: Demo | null;
  onCreated: (c: SavedCase) => void;
  onCancel: () => void;
}) {
  const [questions, setQuestions] = useState<IntakeQuestions | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  async function buildBrief(finalAnswers: { question: string; answer: string }[]) {
    setBuilding(true);
    setError(null);
    try {
      const response = await fetch("/api/case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "brief", problem, answers: finalAnswers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not build your case brief.");
      const now = Date.now();
      const entry: SavedCase = {
        id: crypto.randomUUID(),
        problem,
        intake: finalAnswers,
        brief: data.brief,
        documentIds: [],
        createdAt: now,
        updatedAt: now,
      };
      saveCase(entry);
      onCreated(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build your case brief.");
      setBuilding(false);
    }
  }

  useEffect(() => {
    // Guard against React strict-mode double-invoke, but allow explicit retries.
    if (started.current === attempt) return;
    started.current = attempt;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/case", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "intake", problem }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not generate questions.");
        setQuestions(data.questions);
        setAnswers(data.questions.questions.map(() => ""));
        if (data.questions.questions.length === 0) {
          // Nothing to clarify — go straight to the brief.
          setLoading(false);
          await buildBrief([]);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate questions.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const intakeDone = questions?.questions.map((q, i) => ({
    question: q.question,
    answer: (answers[i] ?? "").trim(),
  }));

  return (
    <section aria-labelledby="intake-heading" className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="intake-heading" className="text-lg font-bold text-ink">
          A few questions first
        </h2>
        <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1 text-sm text-accent">
          ← Start over
        </button>
      </div>
      <blockquote className="border-l-2 border-line pl-3 text-sm text-muted italic">
        {problem}
      </blockquote>

      {loading && (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          Thinking about your situation…
        </p>
      )}
      {error && !loading && (
        <div role="alert" className="space-y-2">
          <p className="rounded bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {questions && questions.questions.length > 0 && !building && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (intakeDone) void buildBrief(intakeDone);
          }}
          className="space-y-5"
        >
          {questions.questions.map((q, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-4">
              <label htmlFor={`intake-q-${i}`} className="block font-medium text-ink">
                {q.question}
              </label>
              {q.whyAsking && <p className="mt-0.5 text-xs text-muted">{q.whyAsking}</p>}
              <textarea
                id={`intake-q-${i}`}
                rows={2}
                maxLength={4000}
                value={answers[i] ?? ""}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </div>
          ))}

          {demo && (
            <button
              type="button"
              onClick={() => setAnswers(questions.questions.map((_, i) => demo.answers[i] ?? ""))}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-accent"
            >
              Use example answers
            </button>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent"
            >
              Build my case brief
            </button>
            <p className="text-xs text-muted">
              You can skip any question — Legible works with what you give it.
            </p>
          </div>
        </form>
      )}

      {building && (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          Organizing your situation — this usually takes under a minute…
        </p>
      )}
      {error && building && (
        <p role="alert" className="rounded bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
