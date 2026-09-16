import type { SavedCase } from "./case-storage";

/**
 * Case readiness: a deterministic, transparent measure of how complete the
 * PREPARED INFORMATION is — never a legal-strength or outcome score. The
 * percentage is computed from structured case data only; no AI involvement,
 * so the same case always yields the same number.
 */

export type ReadinessItem = { label: string; done: boolean };

export type Readiness = {
  percent: number;
  items: ReadinessItem[];
};

export function caseReadiness(c: SavedCase, documentCount: number): Readiness {
  const items: ReadinessItem[] = [
    { label: "Situation described", done: c.problem.trim().length >= 20 },
    {
      label: "Clarifying questions answered",
      done: c.intake.some((a) => a.answer.trim().length > 0),
    },
    { label: "Parties identified", done: c.brief.parties.length > 0 },
    { label: "Timeline established", done: c.brief.timeline.length > 0 },
    { label: "Document attached", done: documentCount > 0 },
    { label: "Communication draft prepared", done: Boolean(c.draft) },
  ];
  const done = items.filter((i) => i.done).length;
  return {
    percent: Math.round((done / items.length) * 100),
    items,
  };
}
