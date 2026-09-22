import { describe, expect, it } from "vitest";
import { DEMOS, demoById } from "../lib/demo";
import { AskRequestSchema, CaseBriefSchema, CaseRequestSchema } from "../lib/schemas";
import { MAX_TEXT_CHARS, MIN_TEXT_CHARS } from "../lib/document";
import { caseReadiness } from "../lib/readiness";
import { buildLawyerBriefText } from "../lib/lawyer-brief";
import type { SavedCase } from "../lib/case-storage";
import type { SavedDocument } from "../lib/storage";

/**
 * End-to-end flow regressions for the three shipped scenarios (housing,
 * employment, consumer). Everything here is deterministic — no AI call — so it
 * pins the parts of each journey that must not break: that the demo payloads
 * actually satisfy the request schemas the UI sends, that readiness and the
 * consultation brief are computed from structured data alone, and that the
 * legal-safety framing survives.
 */

/** A document with a fixed analysis, so flows can be asserted without AI. */
function documentFixture(over: Partial<SavedDocument> = {}): SavedDocument {
  return {
    id: "d1",
    name: "Rental agreement.pdf",
    documentType: "Residential lease agreement",
    savedAt: 1,
    truncated: false,
    docText: "…",
    analysis: {
      documentType: "Residential lease agreement",
      plainSummary: "A lease with a one-sided termination clause.",
      keyClauses: [],
      obligations: [],
      concerns: [
        {
          title: "One-sided termination notice",
          severity: "high",
          quote: "the Tenant may terminate only with 120 days written notice",
          whyItMatters: "It may affect how much notice you must give.",
        },
      ],
      missingInformation: [
        {
          item: "Signature date left blank",
          whyItMatters: "Worth confirming before relying on the dates.",
          location: "Signatures",
          source: "Date: ______________",
        },
      ],
      partyAsymmetries: [
        {
          topic: "Termination notice",
          partyAPosition: "Landlord: 30 days written notice",
          partyBPosition: "Tenant: 120 days written notice",
          whyItMayMatter: "The notice periods differ between the parties.",
          sourceA: "30 days written notice",
          sourceB: "120 days written notice",
        },
      ],
      questionsForLawyer: [],
      nextSteps: [],
      suggestedScenarios: [],
      quotesVerified: { clauses: [], obligations: [], concerns: [true] },
      missingVerified: [true],
      asymmetriesVerified: [true, true],
    },
    ...over,
  };
}

function briefFor(problem: string) {
  return {
    situationSummary: problem,
    knownFacts: [
      { text: "The person described the situation.", source: "user" as const },
      { text: "A written agreement exists.", source: "document" as const },
    ],
    parties: [{ name: "Other party", role: "Counterparty" }],
    amounts: [{ amount: "₹50,000", whatFor: "Amount in dispute" }],
    timeline: [{ date: "12 August", event: "The event described", source: "user" as const }],
    informationGaps: [
      { gap: "A written response", whyItMayHelp: "It may help you prepare.", howToGet: "Ask in writing." },
    ],
    nextSteps: [{ action: "Request it in writing", whyItMayHelp: "It creates a record." }],
    questionsForLawyer: ["What are my options?"],
  };
}

function caseFixture(demo: (typeof DEMOS)[number], over: Partial<SavedCase> = {}): SavedCase {
  return {
    id: demo.id,
    problem: demo.problem,
    intake: demo.answers.map((answer, i) => ({ question: `Question ${i + 1}`, answer })),
    brief: CaseBriefSchema.parse(briefFor(demo.problem)),
    documentIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

/** A different draft type per scenario, so the journey is exercised variedly. */
const DRAFT_FOR: Record<string, "written-request" | "payment-request" | "complaint"> = {
  deposit: "written-request",
  salary: "payment-request",
  refund: "complaint",
};

describe("demo catalogue", () => {
  it("ships three demos with distinct ids and chips", () => {
    expect(DEMOS).toHaveLength(3);
    expect(new Set(DEMOS.map((d) => d.id)).size).toBe(3);
    expect(new Set(DEMOS.map((d) => d.chip)).size).toBe(3);
    expect(demoById("deposit")?.chip).toBe("Security deposit");
    expect(demoById("nope")).toBeUndefined();
  });
});

for (const demo of DEMOS) {
  describe(`${demo.id} flow`, () => {
    const intake = demo.answers.map((answer, i) => ({ question: `Question ${i + 1}`, answer }));

    it("passes every request schema the journey sends", () => {
      // 1. Intake questions from the problem text alone.
      expect(CaseRequestSchema.safeParse({ mode: "intake", problem: demo.problem }).success).toBe(
        true,
      );

      // 2. The case brief from the answers.
      expect(
        CaseRequestSchema.safeParse({ mode: "brief", problem: demo.problem, answers: intake }).success,
      ).toBe(true);

      // 3. The brief refresh after the sample document is attached.
      expect(
        CaseRequestSchema.safeParse({
          mode: "brief",
          problem: demo.problem,
          answers: intake,
          documentFindings: ["Rental agreement.pdf (Residential lease agreement):"],
        }).success,
      ).toBe(true);

      // 4. The draft, which additionally carries the document text.
      expect(
        CaseRequestSchema.safeParse({
          mode: "draft",
          problem: demo.problem,
          answers: intake,
          draftType: DRAFT_FOR[demo.id],
          documentText: demo.sample.text,
        }).success,
      ).toBe(true);

      // 5. Follow-up Q&A and scenarios over the same text.
      expect(
        AskRequestSchema.safeParse({
          documentText: demo.sample.text,
          question: "What happens if I pay late?",
        }).success,
      ).toBe(true);
    });

    it("ships a sample document the analyzer will actually accept", () => {
      // The sample is pasted text, so it must clear the same minimum the
      // upload path enforces, and stay under the extraction cap.
      expect(demo.sample.text.trim().length).toBeGreaterThanOrEqual(MIN_TEXT_CHARS);
      expect(demo.sample.text.length).toBeLessThanOrEqual(MAX_TEXT_CHARS);
      expect(demo.sample.name.length).toBeGreaterThan(0);
    });

    it("computes readiness from structured data alone, rising as the case fills in", () => {
      const partial = caseFixture(demo);
      const r1 = caseReadiness(partial, 0);
      expect(r1).toEqual(caseReadiness(partial, 0)); // deterministic — no AI

      const filled = caseFixture(demo, {
        documentIds: ["d1"],
        draft: { draftText: "x", basedOn: [] },
      });
      const r2 = caseReadiness(filled, 1);
      expect(r2.percent).toBe(100);
      expect(r2.percent).toBeGreaterThan(r1.percent);
    });

    it("composes the consultation brief with source labels and no outcome claims", () => {
      const text = buildLawyerBriefText(
        caseFixture(demo, { documentIds: ["d1"], draft: { draftText: "x", basedOn: [] } }),
        [documentFixture()],
      );
      expect(text).toContain(demo.problem);
      expect(text).toContain("[You said]");
      expect(text).toContain("[From document]");
      expect(text).toContain("One-sided termination notice");
      expect(text).toContain("Signature date left blank");
      expect(text).toContain("Party differences:");
      expect(text).toContain("not legal advice");
      // The legal-safety boundary must survive composition.
      expect(text).not.toMatch(/you will (win|lose)/i);
      expect(text).not.toMatch(/we guarantee|legally entitled/i);
    });
  });
}
