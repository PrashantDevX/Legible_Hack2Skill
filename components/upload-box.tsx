"use client";

import { useRef, useState } from "react";

/** Shared upload UI: drag-and-drop/browse a file, or paste text. The parent
 *  performs the actual analysis call (the case workspace adds its problem
 *  context to the request). */
export function UploadBox({
  busy,
  onAnalyze,
  samples = [],
}: {
  busy: boolean;
  onAnalyze: (file: File | null, text: string, name?: string) => void;
  samples?: { label: string; name: string; text: string }[];
}) {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <div className="mb-4 flex gap-2 text-sm" aria-label="Input method">
        <button
          type="button"
          aria-pressed={mode === "file"}
          onClick={() => setMode("file")}
          className={`rounded-lg px-3 py-1.5 font-medium ${mode === "file" ? "bg-accent text-on-accent" : "bg-soft text-muted"}`}
        >
          Upload a file
        </button>
        <button
          type="button"
          aria-pressed={mode === "text"}
          onClick={() => setMode("text")}
          className={`rounded-lg px-3 py-1.5 font-medium ${mode === "text" ? "bg-accent text-on-accent" : "bg-soft text-muted"}`}
        >
          Paste text
        </button>
      </div>

      {mode === "file" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) onAnalyze(file, "");
          }}
          className={`rounded-lg border-2 border-dashed p-6 text-center ${dragging ? "border-accent bg-accent-soft" : "border-line"}`}
        >
          <p className="text-sm">
            Drag a document here, or{" "}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="font-medium text-accent underline disabled:opacity-50"
            >
              browse files
            </button>
            .
          </p>
          <p className="mt-1 text-xs text-muted">PDF, DOCX, or TXT — up to 5 MB</p>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="sr-only"
            aria-label="Choose a document file"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) onAnalyze(file, "");
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor={`doc-text-${samples.length}`} className="block text-sm font-medium">
            Paste the document text
          </label>
          <textarea
            id={`doc-text-${samples.length}`}
            rows={5}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste an agreement, notice, receipt, chat conversation…"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              onAnalyze(null, pasted);
              setPasted("");
            }}
            disabled={pasted.trim().length < 200 || busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            Analyze this text
          </button>
          {pasted.trim().length > 0 && pasted.trim().length < 200 && (
            <p className="text-xs text-muted">
              {(200 - pasted.trim().length).toLocaleString()} more characters needed.
            </p>
          )}
        </div>
      )}

      {samples.length > 0 && (
        <p className="mt-4 text-center text-xs text-muted">
          No file at hand?{" "}
          {samples.map((s, i) => (
            <span key={s.label}>
              {i > 0 && " · "}
              <button
                type="button"
                disabled={busy}
                onClick={() => onAnalyze(null, s.text, s.name)}
                className="font-medium text-accent underline disabled:opacity-50"
              >
                {s.label}
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
