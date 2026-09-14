import { z } from "zod";

/**
 * Shared request/response schemas. The AI output schemas are used both to
 * constrain the model (structured outputs) and to validate what comes back
 * before anything reaches the UI.
 */

export const SeveritySchema = z.enum(["low", "medium", "high"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const KeyClauseSchema = z.object({
  title: z.string().describe("Short clause name, e.g. 'Termination'"),
  quote: z.string().describe("Verbatim quote from the document"),
  plainExplanation: z.string().describe("What this clause means in plain language"),
  location: z.string().optional().describe("Section/heading it appears under, e.g. 'Section 4 — Early Termination'; omit if not identifiable"),
});

export const ObligationSchema = z.object({
  obligation: z.string().describe("What the signer must do (or is entitled to), in plain language"),
  quote: z.string().describe("Verbatim quote from the document supporting this obligation"),
  location: z.string().optional().describe("Section/heading it appears under; omit if not identifiable"),
});

export const ConcernSchema = z.object({
  title: z.string().describe("Short name of the concern"),
  severity: SeveritySchema,
  quote: z.string().describe("Verbatim quote from the document"),
  whyItMatters: z.string().describe("Why this may deserve attention, in cautious plain language"),
  location: z.string().optional().describe("Section/heading it appears under; omit if not identifiable"),
});

export const MissingItemSchema = z.object({
  item: z.string().describe("What appears incomplete, blank, placeholder, or missing, e.g. 'Move-in date left blank'"),
  whyItMatters: z.string().describe("Why verifying this before signing may matter, in cautious plain language"),
  location: z.string().describe("Where it appears: section, heading, or nearest identifiable text"),
  source: z.string().describe("Short verbatim excerpt showing the blank/placeholder or the reference to the missing item"),
});

export const AsymmetrySchema = z.object({
  topic: z.string().describe("What is being compared, e.g. 'Termination notice'"),
  partyAPosition: z.string().describe("One party's position, naming the party, e.g. 'Landlord: may terminate on 30 days notice'"),
  partyBPosition: z.string().describe("The other party's position, naming the party"),
  whyItMayMatter: z.string().describe("Why this difference may matter, in cautious plain language — never call it unfair or illegal"),
  sourceA: z.string().describe("Verbatim quote supporting party A's position"),
  sourceB: z.string().describe("Verbatim quote supporting party B's position"),
});

export const AnalysisSchema = z.object({
  documentType: z.string().describe("Plain-language document type, e.g. 'Residential lease agreement'"),
  plainSummary: z.string().describe("3-6 sentence plain-language summary of what the reader is being asked to agree to"),
  keyClauses: z.array(KeyClauseSchema).describe("The 3-8 most important clauses"),
  obligations: z.array(ObligationSchema).describe("Key obligations and entitlements of the reader"),
  concerns: z.array(ConcernSchema).describe("Clauses that may disadvantage or surprise the reader"),
  missingInformation: z.array(MissingItemSchema).describe("Blank, placeholder, or apparently missing important information; empty list if none"),
  partyAsymmetries: z.array(AsymmetrySchema).describe("Meaningful differences between the parties' obligations/rights; empty list if none or only one party"),
  questionsForLawyer: z.array(z.string()).describe("4-8 specific questions worth asking a qualified legal professional"),
  nextSteps: z.array(z.string()).describe("3-6 practical, non-binding next steps"),
  suggestedScenarios: z.array(z.string()).describe("3-4 'What happens if...' questions this specific document can answer, e.g. 'What happens if I pay rent late?'"),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const SupportingQuoteSchema = z.object({
  quote: z.string().describe("Verbatim quote from the document that supports the answer"),
  explains: z.string().describe("How this passage relates to the question"),
});

export const AnswerSchema = z.object({
  answer: z.string().describe("Plain-language answer grounded in the document"),
  supportingQuotes: z.array(SupportingQuoteSchema),
  supportedByDocument: z
    .boolean()
    .describe("true only if the document itself contains the answer; false if the document does not say"),
});
export type Answer = z.infer<typeof AnswerSchema>;

/** "What if?" scenario: what the document says happens if X occurs. */
export const ScenarioSchema = z.object({
  trigger: z.string().describe("The event or condition that sets this in motion, as the document describes it"),
  relevantClause: z.string().describe("The clause or section that governs it, in plain words"),
  whatHappens: z.string().describe("What the document says happens, in plain language"),
  whatToVerify: z.string().describe("What the reader may want to verify before relying on this"),
  source: z.string().describe("Short verbatim quote from the document supporting this"),
  determinedFromDocument: z
    .boolean()
    .describe("true only if the document contains enough information; false if it does not"),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

// --- API request payloads ---------------------------------------------------

export const AskRequestSchema = z.object({
  documentText: z.string().min(1).max(200_000),
  question: z.string().trim().min(3, "Question is too short").max(1000),
  history: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .max(10)
    .default([]),
  mode: z.enum(["ask", "scenario"]).default("ask"),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

// Server-annotated forms: each AI quote is checked against the source text
// and marked verified (grounding proof surfaced in the UI). Page numbers are
// derived from the PDF extraction pipeline's page markers when present.

export type PageMap = {
  clauses: (number | null)[];
  obligations: (number | null)[];
  concerns: (number | null)[];
  missing: (number | null)[];
  /** Two entries per asymmetry: sourceA's page, then sourceB's. */
  asymmetries: (number | null)[];
};

export type VerifiedAnalysis = Analysis & {
  quotesVerified: { clauses: boolean[]; obligations: boolean[]; concerns: boolean[] };
  /** Grounding for missing-information sources (missing items may describe a blank rather than quote it, so unverified here means "treat with care"). */
  missingVerified?: boolean[];
  /** Two entries per asymmetry: sourceA, then sourceB. */
  asymmetriesVerified?: boolean[];
  /** Pages derived from PDF page markers; absent for pasted/DOCX text. */
  pages?: PageMap;
};

export type VerifiedAnswer = Answer & { quotesVerified: boolean[] };
export type VerifiedScenario = Scenario & { sourceVerified: boolean; page: number | null };
