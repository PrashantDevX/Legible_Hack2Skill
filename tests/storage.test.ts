import { afterEach, describe, expect, it } from "vitest";
import {
  deleteDocument,
  isSavedDocument,
  listDocuments,
  saveDocument,
  type SavedDocument,
} from "../lib/storage";

const doc = (over: Partial<SavedDocument> = {}): SavedDocument => ({
  id: "doc-1",
  name: "lease.pdf",
  documentType: "Residential lease agreement",
  savedAt: 1_700_000_000_000,
  truncated: false,
  docText: "full text of the lease",
  analysis: {
    documentType: "Residential lease agreement",
    plainSummary: "A one-year lease.",
    keyClauses: [],
    obligations: [],
    concerns: [],
    questionsForLawyer: [],
    nextSteps: [],
    quotesVerified: { clauses: [], obligations: [], concerns: [] },
  },
  ...over,
});

// Minimal in-memory localStorage stand-in for the Node test env.
function stubStorage() {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
  });
  return map;
}

describe("storage", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: undefined });
  });

  it("round-trips a saved document, newest first", () => {
    stubStorage();
    saveDocument(doc({ id: "a", savedAt: 1 }));
    saveDocument(doc({ id: "b", savedAt: 2, name: "nda.docx" }));
    const all = listDocuments();
    expect(all.map((d) => d.id)).toEqual(["b", "a"]);
    expect(all[1].analysis.plainSummary).toBe("A one-year lease.");
  });

  it("caps history at 20 entries, evicting the oldest", () => {
    stubStorage();
    for (let i = 0; i < 25; i++) saveDocument(doc({ id: `d${i}`, savedAt: i }));
    const all = listDocuments();
    expect(all).toHaveLength(20);
    expect(all.some((d) => d.id === "d0")).toBe(false);
    expect(all.some((d) => d.id === "d24")).toBe(true);
  });

  it("deletes a document by id", () => {
    stubStorage();
    saveDocument(doc({ id: "keep" }));
    saveDocument(doc({ id: "drop" }));
    deleteDocument("drop");
    expect(listDocuments().map((d) => d.id)).toEqual(["keep"]);
  });

  it("returns empty list when storage is unavailable or corrupt", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: undefined });
    expect(listDocuments()).toEqual([]);
    stubStorage();
    localStorage.setItem("legible-documents", "{not json");
    expect(listDocuments()).toEqual([]);
  });

  it("isSavedDocument rejects malformed entries", () => {
    expect(isSavedDocument(doc())).toBe(true);
    expect(isSavedDocument({ id: "x" })).toBe(false);
    expect(isSavedDocument(null)).toBe(false);
    expect(
      isSavedDocument({ ...doc(), analysis: { ...doc().analysis, concerns: "many" } }),
    ).toBe(false);
  });
});
