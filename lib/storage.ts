import type { VerifiedAnalysis } from "./schemas";

/**
 * Local document history. Analyses and their documents are stored in this
 * browser's localStorage only — never on any server. Storage is best-effort:
 * if the browser blocks it (private mode, quota), the app works without
 * history.
 */

export type SavedDocument = {
  id: string;
  name: string;
  documentType: string;
  savedAt: number; // epoch ms
  truncated: boolean;
  docText: string;
  analysis: VerifiedAnalysis;
};

const KEY = "legible-documents";
const MAX_SAVED = 20;

export function isSavedDocument(value: unknown): value is SavedDocument {
  const doc = value as SavedDocument;
  return (
    typeof doc?.id === "string" &&
    typeof doc?.name === "string" &&
    typeof doc?.docText === "string" &&
    !!doc?.analysis?.documentType &&
    Array.isArray(doc?.analysis?.concerns)
  );
}

export function listDocuments(): SavedDocument[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedDocument).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function saveDocument(entry: SavedDocument): SavedDocument[] {
  const next = [entry, ...listDocuments().filter((doc) => doc.id !== entry.id)].slice(0, MAX_SAVED);
  persist(next);
  return next;
}

export function deleteDocument(id: string): SavedDocument[] {
  const next = listDocuments().filter((doc) => doc.id !== id);
  persist(next);
  return next;
}

function persist(documents: SavedDocument[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(documents));
  } catch {
    // Blocked or full — history is best-effort; analysis still works.
  }
}
