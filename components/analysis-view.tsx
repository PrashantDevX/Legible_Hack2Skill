import type { VerifiedAnalysis } from "@/lib/schemas";
import { EvidenceBlock, Section, SeverityChip } from "./bits";

/** The consultation-ready brief: summary, clauses, obligations, concerns,
 *  missing information, party imbalances, questions for a lawyer, next steps.
 *  Fields added after launch (missing, asymmetries, pages) may be absent in
 *  documents saved before the upgrade — hence the ?? [] fallbacks. */

export function AnalysisView({ analysis }: { analysis: VerifiedAnalysis }) {
  const proof = analysis.quotesVerified;
  const pages = analysis.pages;
  const missing = analysis.missingInformation ?? [];
  const missingVerified = analysis.missingVerified ?? [];
  const asymmetries = analysis.partyAsymmetries ?? [];
  const asymmetriesVerified = analysis.asymmetriesVerified ?? [];

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
              <EvidenceBlock
                quote={clause.quote}
                verified={proof.clauses[i]}
                page={pages?.clauses?.[i]}
                location={clause.location}
                explanation={clause.plainExplanation}
              />
            </article>
          ))}
        </div>
      </Section>

      <Section title="What you're agreeing to" count={analysis.obligations.length}>
        <ul className="space-y-3">
          {analysis.obligations.map((item, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface p-4">
              <p className="text-sm leading-relaxed">{item.obligation}</p>
              <EvidenceBlock
                quote={item.quote}
                verified={proof.obligations[i]}
                page={pages?.obligations?.[i]}
                location={item.location}
              />
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
                <EvidenceBlock
                  quote={concern.quote}
                  verified={proof.concerns[i]}
                  page={pages?.concerns?.[i]}
                  location={concern.location}
                  explanation={concern.whyItMatters}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Missing or incomplete" count={missing.length}>
        {missing.length === 0 ? (
          <p className="text-sm text-muted">
            No obvious missing or incomplete information detected.
          </p>
        ) : (
          <ul className="space-y-3">
            {missing.map((item, i) => (
              <li key={i} className="rounded-lg border border-line bg-surface p-4">
                <p className="font-medium text-ink">{item.item}</p>
                <p className="mt-1 text-sm leading-relaxed">{item.whyItMatters}</p>
                <EvidenceBlock
                  quote={item.source}
                  verified={missingVerified[i]}
                  page={pages?.missing?.[i]}
                  location={item.location}
                  explanation={item.whyItMatters}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Potential imbalances" count={asymmetries.length}>
        {asymmetries.length === 0 ? (
          <p className="text-sm text-muted">
            No significant differences between the parties&rsquo; obligations or rights were
            identified in this document.
          </p>
        ) : (
          <ul className="space-y-3">
            {asymmetries.map((a, i) => (
              <li key={i} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">{a.topic}</h3>
                  <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
                    Potential imbalance
                  </span>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm leading-relaxed">{a.partyAPosition}</p>
                    <EvidenceBlock
                      quote={a.sourceA}
                      verified={asymmetriesVerified[i * 2]}
                      page={pages?.asymmetries?.[i * 2]}
                    />
                  </div>
                  <div>
                    <p className="text-sm leading-relaxed">{a.partyBPosition}</p>
                    <EvidenceBlock
                      quote={a.sourceB}
                      verified={asymmetriesVerified[i * 2 + 1]}
                      page={pages?.asymmetries?.[i * 2 + 1]}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{a.whyItMayMatter}</p>
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
