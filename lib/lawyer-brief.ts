import type { SavedCase } from "./case-storage";
import type { SavedDocument } from "./storage";

/**
 * The professional consultation brief — composed deterministically from the
 * case's structured data and its documents' verified findings. Deliberately
 * NO AI call: every line traces to something the user said, a document
 * finding, or the case brief the user already reviewed.
 */

export const SOURCE_LABELS = { user: "You said", document: "From document", ai: "AI interpretation" } as const;

export function buildLawyerBriefText(c: SavedCase, docs: SavedDocument[]): string {
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines, "");

  push("LEGAL SITUATION", c.problem);

  push("SITUATION SUMMARY (AI-ORGANIZED — VERIFY BEFORE RELYING)", c.brief.situationSummary);

  push("KNOWN FACTS", ...c.brief.knownFacts.map((f) => `- ${f.text} [${SOURCE_LABELS[f.source]}]`));

  if (c.brief.parties.length > 0) {
    push("PARTIES", ...c.brief.parties.map((p) => `- ${p.name} — ${p.role}`));
  }

  if (c.brief.timeline.length > 0) {
    push(
      "TIMELINE",
      ...c.brief.timeline.map((e) => `- ${e.date}: ${e.event} [${SOURCE_LABELS[e.source]}]`),
    );
  }

  if (c.brief.amounts.length > 0) {
    push("AMOUNTS", ...c.brief.amounts.map((a) => `- ${a.amount} — ${a.whatFor}`));
  }

  if (docs.length > 0) {
    push("DOCUMENTS / EVIDENCE", ...docs.map((d) => `- ${d.name} (${d.documentType})`));
  }

  const findings = docs.flatMap((d) => {
    const a = d.analysis;
    const lines: string[] = [];
    if (a.concerns.length > 0) {
      lines.push(`  Concerns:`);
      a.concerns.forEach((c2, i) =>
        lines.push(
          `  - [${c2.severity}] ${c2.title}: "${c2.quote}"${a.quotesVerified.concerns[i] === false ? " (quote not verified word-for-word)" : ""}`,
        ),
      );
    }
    const missing = a.missingInformation ?? [];
    if (missing.length > 0) {
      lines.push(`  Missing/incomplete:`);
      missing.forEach((m) => lines.push(`  - ${m.item}`));
    }
    const asymmetries = a.partyAsymmetries ?? [];
    if (asymmetries.length > 0) {
      lines.push(`  Party differences:`);
      asymmetries.forEach((a2) => lines.push(`  - ${a2.topic}: ${a2.partyAPosition} vs ${a2.partyBPosition}`));
    }
    return lines.length > 0 ? [`${d.name}:`, ...lines] : [];
  });
  if (findings.length > 0) {
    push("IMPORTANT DOCUMENT FINDINGS", ...findings);
  }

  if (c.brief.informationGaps.length > 0) {
    push(
      "INFORMATION GAPS",
      ...c.brief.informationGaps.map((g) => `- ${g.gap} — may help: ${g.whyItMayHelp}`),
    );
  }

  if (c.brief.questionsForLawyer.length > 0) {
    push(
      "QUESTIONS TO ASK A LEGAL PROFESSIONAL",
      ...c.brief.questionsForLawyer.map((q, i) => `${i + 1}. ${q}`),
    );
  }

  if (c.brief.nextSteps.length > 0) {
    push(
      "POSSIBLE NEXT STEPS TO DISCUSS",
      ...c.brief.nextSteps.map((s) => `- ${s.action} — ${s.whyItMayHelp}`),
    );
  }

  push(
    "Prepared with Legible — informational assistance only, not legal advice. Facts marked [AI interpretation] are automated summaries and should be verified. Document quotes marked unverified did not appear word-for-word in the source text.",
  );

  return out.join("\n").trim() + "\n";
}
