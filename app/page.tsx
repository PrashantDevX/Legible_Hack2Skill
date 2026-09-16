"use client";

import { useEffect, useState } from "react";
import { CaseWorkspace } from "@/components/case-workspace";
import { CasesView } from "@/components/cases-view";
import { DocumentView } from "@/components/document-view";
import { DocumentsView } from "@/components/documents-view";
import { HomeView } from "@/components/home-view";
import { IntakePanel } from "@/components/intake-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { demoById } from "@/lib/demo";
import { deleteCase, listCases, type SavedCase } from "@/lib/case-storage";
import { deleteDocument, listDocuments, type SavedDocument } from "@/lib/storage";

/** Where the user is: home, mid-intake, a list, or one case/document. */
type View =
  | { kind: "home" }
  | { kind: "intake"; problem: string; demoId: string | null }
  | { kind: "cases" }
  | { kind: "documents" }
  | { kind: "case"; id: string }
  | { kind: "doc"; id: string; from: "documents" | { caseId: string } };

export default function Home() {
  const [view, setView] = useState<View>({ kind: "home" });
  const [cases, setCases] = useState<SavedCase[]>([]);
  const [docs, setDocs] = useState<SavedDocument[]>([]);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setCases(listCases());
    setDocs(listDocuments());
  }

  const openCase = view.kind === "case" ? cases.find((c) => c.id === view.id) : undefined;
  const docFromCase = view.kind === "doc" && view.from !== "documents" ? view.from : null;
  const caseOfDoc = docFromCase ? cases.find((c) => c.id === docFromCase.caseId) : undefined;
  const openDoc =
    view.kind === "doc" ? docs.find((d) => d.id === view.id) ?? null : null;

  const back = (() => {
    switch (view.kind) {
      case "intake":
        return { label: "← Start over", go: () => setView({ kind: "home" }) };
      case "cases":
      case "documents":
        return { label: "← Home", go: () => setView({ kind: "home" }) };
      case "case":
        return { label: "← My cases", go: () => setView({ kind: "cases" }) };
      case "doc": {
        if (view.from === "documents")
          return { label: "← All documents", go: () => setView({ kind: "documents" }) };
        const caseId = view.from.caseId;
        return { label: "← Back to case", go: () => setView({ kind: "case", id: caseId }) };
      }
      default:
        return null;
    }
  })();

  const onMainViews = view.kind === "home" || view.kind === "cases" || view.kind === "documents";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {view.kind === "home" ? (
            <span className="text-base font-bold tracking-tight text-ink">Legible</span>
          ) : (
            <button
              onClick={back?.go}
              className="rounded-lg px-2 py-1 text-sm font-medium text-accent -ml-2"
            >
              {back?.label}
            </button>
          )}
          <div className="flex items-center gap-2">
            {onMainViews && (
              <nav aria-label="Main" className="flex items-center gap-1 text-sm">
                <button
                  onClick={() => setView({ kind: "cases" })}
                  aria-current={view.kind === "cases" ? "page" : undefined}
                  className={`rounded-lg px-2.5 py-1.5 font-medium ${view.kind === "cases" ? "bg-soft text-ink" : "text-muted"}`}
                >
                  My cases {cases.length > 0 && `(${cases.length})`}
                </button>
                <button
                  onClick={() => setView({ kind: "documents" })}
                  aria-current={view.kind === "documents" ? "page" : undefined}
                  className={`rounded-lg px-2.5 py-1.5 font-medium ${view.kind === "documents" ? "bg-soft text-ink" : "text-muted"}`}
                >
                  Documents {docs.length > 0 && `(${docs.length})`}
                </button>
              </nav>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {view.kind === "home" && (
          <HomeView
            onNewCase={(problem, demoId) => setView({ kind: "intake", problem, demoId })}
            onOpenDocuments={() => setView({ kind: "documents" })}
          />
        )}

        {view.kind === "intake" && (
          <IntakePanel
            problem={view.problem}
            demo={demoById(view.demoId) ?? null}
            onCreated={(created) => {
              refresh();
              setView({ kind: "case", id: created.id });
            }}
            onCancel={() => setView({ kind: "home" })}
          />
        )}

        {view.kind === "cases" && (
          <CasesView
            cases={cases}
            onOpen={(id) => setView({ kind: "case", id })}
            onDelete={(id) => {
              setCases(deleteCase(id));
            }}
            onNewCase={() => setView({ kind: "home" })}
          />
        )}

        {view.kind === "documents" && (
          <DocumentsView
            docs={docs}
            onAnalyzed={refresh}
            onOpen={(id) => setView({ kind: "doc", id, from: "documents" })}
            onDelete={(id) => {
              setDocs(deleteDocument(id));
            }}
          />
        )}

        {view.kind === "case" &&
          (openCase ? (
            <CaseWorkspace
              caseData={openCase}
              allDocs={docs}
              onChanged={refresh}
              onOpenDocument={(docId) => setView({ kind: "doc", id: docId, from: { caseId: view.id } })}
            />
          ) : (
            <p className="text-sm text-muted">This case no longer exists.</p>
          ))}

        {view.kind === "doc" &&
          (openDoc ? (
            <DocumentView doc={openDoc} situation={caseOfDoc?.problem} />
          ) : (
            <p className="text-sm text-muted">This document no longer exists.</p>
          ))}
      </main>
    </div>
  );
}
