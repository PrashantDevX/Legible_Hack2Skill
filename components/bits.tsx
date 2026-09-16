import type { FactSource, Severity } from "@/lib/schemas";

/** Origin badge for case facts: distinguishes what the person said, what a
 *  document established, and what the AI inferred — never silently mixed. */
const SOURCE_STYLES: Record<FactSource, { label: string; className: string }> = {
  user: { label: "You said", className: "bg-accent-soft text-accent" },
  document: { label: "From document", className: "bg-ok-soft text-ok" },
  ai: { label: "AI interpretation", className: "bg-warn-soft text-warn" },
};

export function SourceBadge({ source }: { source: FactSource }) {
  const s = SOURCE_STYLES[source];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

/** Verbatim quote from the user's document, with grounding status. */
export function QuoteBlock({ quote, verified }: { quote: string; verified: boolean }) {
  return (
    <figure className="mt-2">
      <blockquote className="border-l-2 border-line pl-3 text-sm text-muted italic">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="mt-1 text-xs">
        {verified ? (
          <span className="text-ok">✓ Verified — appears in your document</span>
        ) : (
          <span className="text-warn">Not found word-for-word — AI paraphrase, treat with care</span>
        )}
      </figcaption>
    </figure>
  );
}

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "bg-danger-soft text-danger",
  medium: "bg-warn-soft text-warn",
  low: "bg-soft text-muted",
};

export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}>
      {severity} concern
    </span>
  );
}

/** Collapsible evidence: source location, page (when the PDF provides one),
 *  excerpt, and why it matters — keeps the page scannable by default. */
export function EvidenceBlock({
  quote,
  verified,
  page,
  location,
  explanation,
  label = "Why was this flagged?",
}: {
  quote: string;
  verified: boolean | undefined;
  page?: number | null;
  location?: string;
  explanation?: string;
  label?: string;
}) {
  return (
    <details className="mt-2 rounded-lg bg-soft px-3 py-2 text-sm">
      <summary className="cursor-pointer list-none text-xs font-medium text-accent">
        {label}
        {verified !== undefined && (verified ? " · ✓ verified" : " · unverified excerpt")}
      </summary>
      <div className="mt-2 space-y-2">
        {(location || page) && (
          <p className="text-xs text-muted">
            {[location, page ? `Page ${page}` : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <blockquote className="border-l-2 border-line pl-3 text-sm text-muted italic">
          &ldquo;{quote}&rdquo;
        </blockquote>
        {explanation && <p className="text-xs leading-relaxed text-muted">{explanation}</p>}
      </div>
    </details>
  );
}

export function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-sm font-semibold tracking-wide text-muted uppercase">
        {title}
        {typeof count === "number" ? ` (${count})` : ""}
      </h2>
      {children}
    </section>
  );
}

/** A section that collapses by default — keeps long case workspaces scannable. */
export function CollapsibleSection({
  title,
  count,
  open = false,
  children,
}: {
  title: string;
  count?: number;
  open?: boolean;
  children: React.ReactNode;
}) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <section aria-labelledby={id}>
      <details open={open} className="group rounded-lg border border-line bg-surface">
        <summary id={id} className="cursor-pointer list-none px-4 py-3 text-sm font-semibold tracking-wide text-muted uppercase select-none">
          <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>{" "}
          {title}
          {typeof count === "number" ? ` (${count})` : ""}
        </summary>
        <div className="space-y-3 border-t border-line px-4 py-4">{children}</div>
      </details>
    </section>
  );
}
