import type { CaseBrief, Draft, DraftType } from "./schemas";
import type { SavedDocument, listDocuments } from "./storage";

/**
 * Local case history. Cases live in this browser's localStorage only — never
 * on any server. Documents are NOT copied into the case: the case stores
 * document ids referencing the existing document history, so each document's
 * text is stored exactly once.
 */

export type SavedCase = {
  id: string;
  problem: string;
  /** The clarifying questions and the person's answers, verbatim. */
  intake: { question: string; answer: string }[];
  brief: CaseBrief;
  /** Ids into the document history store. */
  documentIds: string[];
  draftType?: DraftType;
  draft?: Draft;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

const KEY = "legible-cases";
const MAX_CASES = 10;

export function isSavedCase(value: unknown): value is SavedCase {
  const c = value as SavedCase;
  return (
    typeof c?.id === "string" &&
    typeof c?.problem === "string" &&
    Array.isArray(c?.intake) &&
    Array.isArray(c?.documentIds) &&
    !!c?.brief?.situationSummary &&
    Array.isArray(c?.brief?.knownFacts)
  );
}

export function listCases(): SavedCase[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedCase).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** Insert or update (upsert by id), keeping the newest MAX_CASES. */
export function saveCase(entry: SavedCase): SavedCase[] {
  const next = [entry, ...listCases().filter((c) => c.id !== entry.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CASES);
  persist(next);
  return next;
}

export function deleteCase(id: string): SavedCase[] {
  const next = listCases().filter((c) => c.id !== id);
  persist(next);
  return next;
}

function persist(cases: SavedCase[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cases));
  } catch {
    // Blocked or full — history is best-effort; the app still works.
  }
}

/** Resolve a case's documents against the document store, dropping ids that
 *  no longer exist (deleted documents leave no dangling references). */
export function caseDocuments(
  c: SavedCase,
  documents: ReturnType<typeof listDocuments>,
): SavedDocument[] {
  const byId = new Map(documents.map((d) => [d.id, d]));
  return c.documentIds.flatMap((id) => {
    const doc = byId.get(id);
    return doc ? [doc] : [];
  });
}
