"use client";

import type { CaseBrief } from "@/lib/schemas";
import { Section, SourceBadge } from "./bits";

/**
 * The Case Brief's own sections — situation (with source-tagged facts),
 * timeline, information gaps, and next steps. Every fact shows where it came
 * from: "You said", "From document", or "AI interpretation" — never silently
 * mixed. The case workspace composes these with the evidence and document
 * sections.
 */

export function SituationSection({ brief }: { brief: CaseBrief }) {
  return (
    <Section title="Situation">
      <p className="leading-relaxed">{brief.situationSummary}</p>

      {brief.parties.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {brief.parties.map((p, i) => (
            <li key={i} className="rounded-full bg-soft px-3 py-1 text-xs">
              <span className="font-medium">{p.name}</span>
              <span className="text-muted"> · {p.role}</span>
            </li>
          ))}
        </ul>
      )}

      {brief.amounts.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {brief.amounts.map((a, i) => (
            <li key={i} className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">
              <span className="font-medium">{a.amount}</span> — {a.whatFor}
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-2">
        {brief.knownFacts.map((fact, i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg border border-line bg-surface p-3">
            <SourceBadge source={fact.source} />
            <p className="text-sm leading-relaxed">{fact.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function TimelineSection({ brief }: { brief: CaseBrief }) {
  return (
    <Section title="Timeline" count={brief.timeline.length}>
      {brief.timeline.length === 0 ? (
        <p className="text-sm text-muted">No events recorded yet.</p>
      ) : (
        <ol>
          {brief.timeline.map((event, i) => (
            <li key={i} className="relative border-l-2 border-line py-3 pl-5 -ml-[1px]">
              <span
                aria-hidden
                className="absolute top-[1.15rem] -left-[5px] h-2 w-2 rounded-full bg-accent"
              />
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{event.date}</p>
                <SourceBadge source={event.source} />
              </div>
              <p className="mt-0.5 text-sm leading-relaxed">{event.event}</p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function GapsSection({ brief }: { brief: CaseBrief }) {
  return (
    <Section title="What may be missing" count={brief.informationGaps.length}>
      {brief.informationGaps.length === 0 ? (
        <p className="text-sm text-muted">
          No obvious information gaps right now — this is not a guarantee that nothing else
          could help.
        </p>
      ) : (
        <ul className="space-y-3">
          {brief.informationGaps.map((gap, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface p-4">
              <p className="font-medium text-ink">⚠ {gap.gap}</p>
              <p className="mt-1 text-sm leading-relaxed">{gap.whyItMayHelp}</p>
              <p className="mt-1 text-xs text-muted">How to get it: {gap.howToGet}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        Missing information affects preparation, not outcomes — it does not mean you would
        lose anything.
      </p>
    </Section>
  );
}

export function NextStepsSection({ brief }: { brief: CaseBrief }) {
  return (
    <Section title="Possible next steps" count={brief.nextSteps.length}>
      <ul className="space-y-3">
        {brief.nextSteps.map((step, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface p-4">
            <p className="font-medium text-ink">{step.action}</p>
            <p className="mt-1 text-sm leading-relaxed">{step.whyItMayHelp}</p>
            {step.caution && (
              <p className="mt-1 text-xs text-muted">Worth checking: {step.caution}</p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
