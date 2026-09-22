import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { cacheKey, cached } from "./ai-cache";
import {
  AnalysisSchema,
  AnswerSchema,
  CaseBriefSchema,
  DraftSchema,
  IntakeQuestionsSchema,
  ScenarioSchema,
  type Analysis,
  type Answer,
  type AskRequest,
  type CaseBrief,
  type Draft,
  type IntakeQuestions,
  type Scenario,
} from "./schemas";
import {
  ANALYSIS_SYSTEM_PROMPT,
  ASK_SYSTEM_PROMPT,
  CASE_BRIEF_SYSTEM_PROMPT,
  DRAFT_SYSTEM_PROMPT,
  INTAKE_SYSTEM_PROMPT,
  SCENARIO_SYSTEM_PROMPT,
  documentBlock,
  tagged,
} from "./prompts";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  // The SDK defaults to 5 attempts on 429/5xx. Retrying a spent daily quota
  // just hammers the API (a wall of 429s), and retrying a mid-generation 5xx
  // re-bills the full input tokens each time. One user action = one call;
  // errors surface immediately as clean messages instead.
  httpOptions: { retryOptions: { attempts: 1 } },
});

export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

/** Zod -> JSON Schema for Gemini's response_format (drop zod's $schema key). */
function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/**
 * Map SDK errors to safe, user-facing messages (no internal detail leaks).
 * Narrows structurally on `status` rather than instanceof ApiError — the SDK
 * ships dual ESM/CJS builds, so the thrown class and the imported one can be
 * different identities under the server bundler.
 */
function toAiError(error: unknown): AiError {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  // SDK error messages carry status/quota detail only — never document content.
  console.error(
    `ai error (${typeof status === "number" ? status : "unknown"}):`,
    error instanceof Error ? error.message : error,
  );
  if (typeof status === "number") {
    if (status === 429) {
      return new AiError(
        "The AI service's free-tier rate limit was hit — either too many requests in a minute, or the model's daily request cap is exhausted, which resets at midnight Pacific time. Please try again later.",
        429,
      );
    }
    if (status === 400 || status === 401 || status === 403) {
      // 400 is typically an invalid API key (the SDK reports it that way).
      return new AiError("The AI service is not configured correctly on the server.", 500);
    }
    if (status >= 500) {
      return new AiError("The AI service is temporarily unavailable. Please try again.", 502);
    }
  }
  return new AiError("Analysis failed. Please try again.", 502);
}

/**
 * Output ceilings per operation. Gemini would otherwise generate until it
 * stops on its own; these bound the worst-case cost of a single request. Each
 * is set well above what the schema asks for, so a normal response is never
 * truncated.
 */
const MAX_OUTPUT_TOKENS = {
  analysis: 8192,
  brief: 8192,
  draft: 4096,
  intake: 2048,
  answer: 2048,
  scenario: 1536,
} as const;

type Operation = keyof typeof MAX_OUTPUT_TOKENS;

/**
 * One structured model call. Gemini enforces the JSON schema in
 * response_format; we re-validate with Zod before anything reaches the UI,
 * so malformed AI output can never crash the app.
 *
 * Identical requests are served from the deterministic cache, so a repeated
 * user action costs no model call. A failure is never cached — it surfaces
 * immediately and stays retryable.
 */
async function generateStructured<T>(
  operation: Operation,
  system: string,
  input: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const produce = async (): Promise<T> => {
    let outputText: string | undefined;
    try {
      const interaction = await client.interactions.create({
        model: MODEL,
        input,
        system_instruction: system,
        response_format: { type: "text", mime_type: "application/json", schema: toGeminiSchema(schema) },
        generation_config: { max_output_tokens: MAX_OUTPUT_TOKENS[operation] },
        store: false, // do not retain the request or response on Google's side
      });
      outputText = interaction.output_text;
    } catch (error) {
      throw toAiError(error);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(outputText ?? "");
    } catch {
      throw new AiError("The AI returned an unreadable response. Please try again.");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new AiError("The AI returned an unexpected response. Please try again.");
    }
    return parsed.data;
  };

  // The model is part of the key: switching GEMINI_MODEL must not serve
  // results produced by the previous one.
  return cached(cacheKey(`${operation}:${MODEL}`, input), produce);
}

/** One structured call: summary, clauses, obligations, concerns, questions, steps.
 *  When a situation is given (case context), it precedes the document so the
 *  analysis can prioritize what matters to the reader's problem. */
export function analyzeDocument(documentText: string, situation?: string): Promise<Analysis> {
  const input = [
    situation?.trim() ? tagged("reader-situation", situation.trim().slice(0, 2000)) : null,
    documentBlock(documentText),
  ]
    .filter(Boolean)
    .join("\n\n");
  return generateStructured("analysis", ANALYSIS_SYSTEM_PROMPT, input, AnalysisSchema);
}

/**
 * Grounded follow-up: a direct question or a "what if?" scenario, each one
 * focused call reusing the already-extracted document text. The result is
 * discriminated so callers narrow by shape, not by cast.
 *
 * `contextNote` carries the caller's note when the document had to be bounded
 * (see boundDocumentContext) so the model knows the text is not complete.
 */
export async function askQuestion(
  request: AskRequest,
  contextNote?: string,
): Promise<{ answer: Answer } | { scenario: Scenario }> {
  const input = [
    contextNote ? tagged("context-note", contextNote) : null,
    request.situation ? tagged("reader-situation", request.situation) : null,
    documentBlock(request.documentText),
    `Question: ${request.question}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (request.mode === "scenario") {
    return {
      scenario: await generateStructured("scenario", SCENARIO_SYSTEM_PROMPT, input, ScenarioSchema),
    };
  }
  const history = request.history
    .map((turn) => `Reader previously asked: ${turn.question}\nYou answered: ${turn.answer}`)
    .join("\n\n");
  return {
    answer: await generateStructured(
      "answer",
      ASK_SYSTEM_PROMPT,
      [history, input].filter(Boolean).join("\n\n"),
      AnswerSchema,
    ),
  };
}

// --- Case workflow (V2): one structured call per user action ------------------

export type CaseAnswer = { question: string; answer: string };

/** Smart intake: 3-5 clarifying questions generated from the problem description. */
export function askIntakeQuestions(problem: string): Promise<IntakeQuestions> {
  return generateStructured(
    "intake",
    INTAKE_SYSTEM_PROMPT,
    tagged("problem", problem),
    IntakeQuestionsSchema,
  );
}

/** The structured, source-tagged case brief. `documentFindings` are compact
 *  summaries of the case's analyzed documents, built client-side. */
export function buildCaseBrief(
  problem: string,
  answers: CaseAnswer[],
  documentFindings: string[] = [],
): Promise<CaseBrief> {
  const input = [
    tagged("problem", problem),
    answers.length
      ? tagged(
          "answers",
          answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n"),
        )
      : null,
    documentFindings.length ? tagged("document-findings", documentFindings.join("\n\n")) : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  return generateStructured("brief", CASE_BRIEF_SYSTEM_PROMPT, input, CaseBriefSchema);
}

/** A factual communication draft — based only on the user's facts, answers,
 *  and (when provided) the analyzed document text. `contextNote` carries the
 *  caller's note when the document had to be bounded (see
 *  boundDocumentContext) so the model knows the text is not complete. */
export function draftCommunication(
  problem: string,
  answers: CaseAnswer[],
  draftType: string,
  documentText?: string,
  contextNote?: string,
): Promise<Draft> {
  const input = [
    contextNote ? tagged("context-note", contextNote) : null,
    tagged("problem", problem),
    answers.length
      ? tagged(
          "answers",
          answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n"),
        )
      : null,
    documentText ? documentBlock(documentText) : null,
    tagged("draft-type", draftType),
  ]
    .filter(Boolean)
    .join("\n\n");
  return generateStructured("draft", DRAFT_SYSTEM_PROMPT, input, DraftSchema);
}
