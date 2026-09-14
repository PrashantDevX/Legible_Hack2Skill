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
});

export const ObligationSchema = z.object({
  obligation: z.string().describe("What the signer must do (or is entitled to), in plain language"),
  quote: z.string().describe("Verbatim quote from the document supporting this obligation"),
});

export const ConcernSchema = z.object({
  title: z.string().describe("Short name of the concern"),
  severity: SeveritySchema,
  quote: z.string().describe("Verbatim quote from the document"),
  whyItMatters: z.string().describe("Why this may deserve attention, in cautious plain language"),
});

export const AnalysisSchema = z.object({
  documentType: z.string().describe("Plain-language document type, e.g. 'Residential lease agreement'"),
  plainSummary: z.string().describe("3-6 sentence plain-language summary of what the reader is being asked to agree to"),
  keyClauses: z.array(KeyClauseSchema).describe("The 3-8 most important clauses"),
  obligations: z.array(ObligationSchema).describe("Key obligations and entitlements of the reader"),
  concerns: z.array(ConcernSchema).describe("Clauses that may disadvantage or surprise the reader"),
  questionsForLawyer: z.array(z.string()).describe("4-8 specific questions worth asking a qualified legal professional"),
  nextSteps: z.array(z.string()).describe("3-6 practical, non-binding next steps"),
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

// --- API request payloads ---------------------------------------------------

export const AskRequestSchema = z.object({
  documentText: z.string().min(1).max(200_000),
  question: z.string().trim().min(3, "Question is too short").max(1000),
  history: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .max(10)
    .default([]),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

// Server-annotated forms: each AI quote is checked against the source text
// and marked verified (grounding proof surfaced in the UI).

export type VerifiedAnalysis = Analysis & {
  quotesVerified: { clauses: boolean[]; obligations: boolean[]; concerns: boolean[] };
};

export type VerifiedAnswer = Answer & { quotesVerified: boolean[] };
