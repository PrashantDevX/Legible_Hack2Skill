import { z } from "zod";
import { MAX_HISTORY_ANSWER_CHARS, MAX_QUESTION_CHARS, MAX_TEXT_CHARS } from "./limits";

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
  /** Bounded by the same cap the extraction pipeline applies, so the client
   *  can never send back more than the server was willing to produce. */
  documentText: z.string().min(1).max(MAX_TEXT_CHARS),
  question: z.string().trim().min(3, "Question is too short").max(MAX_QUESTION_CHARS),
  // Prior turns are replayed into the prompt, so each entry is bounded too —
  // otherwise history is an unbounded way to inflate a single request.
  history: z
    .array(
      z.object({
        question: z.string().max(MAX_QUESTION_CHARS),
        answer: z.string().max(MAX_HISTORY_ANSWER_CHARS),
      }),
    )
    .max(10)
    .default([]),
  mode: z.enum(["ask", "scenario"]).default("ask"),
  /** The reader's legal problem, when Q&A happens inside a case — context
   *  only; answers still come from the document. */
  situation: z.string().trim().max(2000).optional(),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

// --- Case workflow (V2) -------------------------------------------------------
//
// The case model: a person describes a legal problem in plain words, answers a
// few generated clarifying questions, and gets a structured, source-tagged
// Case Brief. Every fact carries its origin — user, document, or AI
// interpretation — so an inference is never silently presented as a user fact.

export const FactSourceSchema = z.enum(["user", "document", "ai"]);
export type FactSource = z.infer<typeof FactSourceSchema>;

export const FactSchema = z.object({
  text: z.string().describe("One established fact, in plain language"),
  source: FactSourceSchema.describe("Where this fact comes from: user (the person stated it), document (from analyzed document findings), or ai (your interpretation of what was said)"),
});

export const TimelineEventSchema = z.object({
  date: z.string().describe("The date or timing exactly as stated ('12 August', 'September 2025'); 'Date not specified' when unknown — never invent a date"),
  event: z.string().describe("What happened, in plain language"),
  source: FactSourceSchema,
});

export const PartySchema = z.object({
  name: z.string().describe("Who this party is, as identified from the information provided"),
  role: z.string().describe("Their role in the situation, e.g. 'Landlord', 'Employer', 'Seller'"),
});

export const AmountSchema = z.object({
  amount: z.string().describe("The amount exactly as stated, e.g. '₹50,000', 'two months rent'"),
  whatFor: z.string().describe("What the amount relates to"),
});

export const InfoGapSchema = z.object({
  gap: z.string().describe("Information or evidence that is not available yet but may help the person understand or prepare, e.g. 'Itemized deduction statement from the landlord'"),
  whyItMayHelp: z.string().describe("Why having this may help — framed as preparation, never as proving or losing anything"),
  howToGet: z.string().describe("A practical way the person might obtain or verify it, e.g. 'Request it in writing from the landlord'"),
});

export const CaseNextStepSchema = z.object({
  action: z.string().describe("One practical, non-binding step, e.g. 'Request the itemized deductions in writing'"),
  whyItMayHelp: z.string().describe("Why this step may help, in cautious plain language"),
  caution: z.string().optional().describe("What to verify or be careful about, when relevant"),
});

export const CaseBriefSchema = z.object({
  situationSummary: z.string().describe("3-6 sentences restating the situation in plain language"),
  knownFacts: z.array(FactSchema).describe("Facts established so far, each with its origin"),
  parties: z.array(PartySchema).describe("People/organizations involved; empty if not identified"),
  amounts: z.array(AmountSchema).describe("Amounts mentioned; empty if none"),
  timeline: z.array(TimelineEventSchema).describe("Events in order; 'Date not specified' when timing is unknown"),
  informationGaps: z.array(InfoGapSchema).describe("Information that may help the person prepare; empty if none"),
  nextSteps: z.array(CaseNextStepSchema).describe("3-6 practical, non-binding next steps to consider"),
  questionsForLawyer: z.array(z.string()).describe("4-8 specific questions worth asking a qualified legal professional"),
});
export type CaseBrief = z.infer<typeof CaseBriefSchema>;

export const IntakeQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().describe("One clarifying question in plain, conversational language — no legal terminology"),
        whyAsking: z.string().describe("One short line on why this question may help"),
      }),
    )
    .max(5)
    .describe("3-5 questions most relevant to this specific situation"),
});
export type IntakeQuestions = z.infer<typeof IntakeQuestionsSchema>;

export const DraftTypeSchema = z.enum([
  "written-request",
  "payment-request",
  "clarification",
  "complaint",
  "response",
]);
export type DraftType = z.infer<typeof DraftTypeSchema>;

export const DraftSchema = z.object({
  draftText: z.string().describe("The complete message ready to copy, starting with a subject line — polite, factual, based only on the provided facts"),
  basedOn: z
    .array(
      z.object({
        point: z.string().describe("One point the draft draws on"),
        source: z.enum(["user", "document"]).describe("user (from the person's answers) or document (from the analyzed document)"),
      }),
    )
    .describe("The specific points this draft is based on"),
});
export type Draft = z.infer<typeof DraftSchema>;

/** One request shape for the three case AI operations, discriminated by mode. */
export const CaseRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("intake"),
    problem: z.string().trim().min(20, "Describe your situation in a little more detail.").max(4000),
  }),
  z.object({
    mode: z.literal("brief"),
    problem: z.string().trim().min(20, "Describe your situation in a little more detail.").max(4000),
    answers: z
      .array(z.object({ question: z.string().max(2000), answer: z.string().max(4000) }))
      .max(8)
      .default([]),
    documentFindings: z.array(z.string().max(4000)).max(10).default([]),
  }),
  z.object({
    mode: z.literal("draft"),
    problem: z.string().trim().min(20, "Describe your situation in a little more detail.").max(4000),
    answers: z
      .array(z.object({ question: z.string().max(2000), answer: z.string().max(4000) }))
      .max(8)
      .default([]),
    draftType: DraftTypeSchema,
    documentText: z.string().max(MAX_TEXT_CHARS).optional(),
  }),
]);
export type CaseRequest = z.infer<typeof CaseRequestSchema>;

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
