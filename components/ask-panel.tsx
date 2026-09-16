"use client";

import { useRef, useState } from "react";
import type { VerifiedAnswer } from "@/lib/schemas";
import { QuoteBlock } from "./bits";

type Turn = { question: string; answer: VerifiedAnswer };

/** Grounded follow-up Q&A about the analyzed document. When a situation is
 *  given (case context), it is sent as context — answers still come only from
 *  the document. */

export function AskPanel({
  documentText,
  situation,
}: {
  documentText: string;
  situation?: string;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<Turn[]>([]); // snapshot sent with each request

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText,
          question: q,
          history: historyRef.current.slice(-5).map((t) => ({
            question: t.question,
            answer: t.answer.answer,
          })),
          ...(situation ? { situation } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not answer.");
      const answer: VerifiedAnswer = data.answer;
      const turn = { question: q, answer };
      historyRef.current = [...historyRef.current, turn];
      setTurns(historyRef.current);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="ask-heading" className="space-y-4">
      <h2 id="ask-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
        Ask about this document
      </h2>
      <p className="text-sm text-muted">
        Answers come only from your document. If it doesn&rsquo;t say, Legible will tell you so.
      </p>

      {turns.length > 0 && (
        <div className="space-y-4" aria-live="polite">
          {turns.map((turn, i) => (
            <article key={i} className="rounded-lg border border-line bg-surface p-4">
              <p className="font-semibold text-ink">{turn.question}</p>
              <p className="mt-2 text-sm leading-relaxed">{turn.answer.answer}</p>
              {turn.answer.supportedByDocument ? (
                turn.answer.supportingQuotes.map((sq, j) => (
                  <QuoteBlock key={j} quote={sq.quote} verified={turn.answer.quotesVerified[j]} />
                ))
              ) : (
                <p className="mt-2 rounded bg-soft px-3 py-2 text-xs text-muted">
                  The document itself does not answer this — the response above is general
                  guidance, not document fact.
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="question" className="sr-only">
          Your question about the document
        </label>
        <input
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What happens if I pay rent a few days late?"
          maxLength={1000}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || question.trim().length < 3}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Ask"}
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
