import type { Severity } from "@/lib/schemas";

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
  return (
    <section aria-labelledby={title.toLowerCase().replace(/[^a-z]+/g, "-")} className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
        {title}
        {typeof count === "number" ? ` (${count})` : ""}
      </h2>
      {children}
    </section>
  );
}
