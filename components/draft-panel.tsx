"use client";

import { useState } from "react";
import type { Draft, DraftType } from "@/lib/schemas";
import { Section } from "./bits";

const DRAFT_TYPES: { value: DraftType; label: string }[] = [
  { value: "written-request", label: "Written request" },
  { value: "payment-request", label: "Payment request" },
  { value: "clarification", label: "Ask for clarification" },
  { value: "complaint", label: "Complaint" },
  { value: "response", label: "Response to the other party" },
];

/**
 * Communication draft: one AI call producing a factual, review-before-sending
 * message based only on the user's facts and analyzed documents. Nothing is
 * ever sent automatically — the user reviews and copies it themselves.
 */
export function DraftPanel({
  problem,
  answers,
  documentText,
  draft,
  onSaved,
}: {
  problem: string;
  answers: { question: string; answer: string }[];
  documentText?: string;
  draft?: Draft;
  onSaved: (draftType: DraftType, draft: Draft) => void;
}) {
  const [draftType, setDraftType] = useState<DraftType>("written-request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "draft",
          problem,
          answers,
          draftType,
          ...(documentText ? { documentText: documentText.slice(0, 120_000) } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not draft the message.");
      onSaved(draftType, data.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft the message.");
    } finally {
      setBusy(false);
    }
  }

  async function copyDraft(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying was blocked by the browser — select the text and copy manually.");
    }
  }

  return (
    <Section title="Draft a message">
      <p className="text-sm text-muted">
        A factual draft you can review, edit, and send yourself. Based only on what you told
        Legible and what your documents say — no legal threats or invented claims.
      </p>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted">What kind of message?</legend>
        <div className="flex flex-wrap gap-2">
          {DRAFT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={draftType === t.value}
              onClick={() => setDraftType(t.value)}
              disabled={busy}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                draftType === t.value ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-50"
      >
        {busy ? "Drafting…" : draft ? "Draft again" : "Draft the message"}
      </button>

      {busy && (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          Writing a draft from your facts…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {draft && (
        <article aria-live="polite" className="space-y-3">
          <p className="rounded bg-warn-soft px-3 py-2 text-xs font-medium text-warn">
            AI-generated draft — review carefully before sending.
          </p>
          <div className="whitespace-pre-wrap rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed">
            {draft.draftText}
          </div>
          {draft.basedOn.length > 0 && (
            <details className="rounded-lg bg-soft px-3 py-2 text-sm">
              <summary className="cursor-pointer list-none text-xs font-medium text-accent">
                What this draft is based on
              </summary>
              <ul className="mt-2 space-y-1">
                {draft.basedOn.map((b, i) => (
                  <li key={i} className="text-xs text-muted">
                    · {b.point} ({b.source === "user" ? "you said" : "from document"})
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={() => copyDraft(draft.draftText)}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium"
          >
            {copied ? "✓ Copied" : "Copy draft"}
          </button>
        </article>
      )}
    </Section>
  );
}
