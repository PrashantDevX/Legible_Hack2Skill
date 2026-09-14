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
