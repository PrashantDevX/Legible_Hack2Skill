import type { VerifiedAnalysis } from "@/lib/schemas";
import { QuoteBlock, Section, SeverityChip } from "./bits";

/** The consultation-ready brief: summary, clauses, obligations, concerns,
 *  questions for a lawyer, next steps. */

export function AnalysisView({ analysis }: { analysis: VerifiedAnalysis }) {
  const { quotesVerified: proof } = analysis;

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          Plain summary
        </h2>
        <p className="mt-2 leading-relaxed">{analysis.plainSummary}</p>
      </header>

      <Section title="Key clauses" count={analysis.keyClauses.length}>
        <div className="grid gap-4 sm:grid-cols-2">
          {analysis.keyClauses.map((clause, i) => (
            <article key={i} className="rounded-lg border border-line bg-surface p-4">
              <h3 className="font-semibold text-ink">{clause.title}</h3>
              <p className="mt-1 text-sm leading-relaxed">{clause.plainExplanation}</p>
              <QuoteBlock quote={clause.quote} verified={proof.clauses[i]} />
            </article>
          ))}
        </div>
      </Section>

      <Section title="What you're agreeing to" count={analysis.obligations.length}>
        <ul className="space-y-3">
          {analysis.obligations.map((item, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface p-4">
              <p className="text-sm leading-relaxed">{item.obligation}</p>
              <QuoteBlock quote={item.quote} verified={proof.obligations[i]} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Potential concerns" count={analysis.concerns.length}>
        {analysis.concerns.length === 0 ? (
          <p className="text-sm text-muted">
            No significant concerns were identified. This is not a guarantee — a professional
            review may still find issues.
          </p>
        ) : (
          <ul className="space-y-3">
            {analysis.concerns.map((concern, i) => (
              <li key={i} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">{concern.title}</h3>
                  <SeverityChip severity={concern.severity} />
                </div>
                <p className="mt-1 text-sm leading-relaxed">{concern.whyItMatters}</p>
                <QuoteBlock quote={concern.quote} verified={proof.concerns[i]} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Questions to ask a lawyer" count={analysis.questionsForLawyer.length}>
        <ol className="space-y-2">
          {analysis.questionsForLawyer.map((question, i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed">
              <span aria-hidden className="font-semibold text-accent">{i + 1}.</span>
              {question}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Possible next steps" count={analysis.nextSteps.length}>
        <ul className="space-y-2">
          {analysis.nextSteps.map((step, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed">
              {step}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
