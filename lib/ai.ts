import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  AnalysisSchema,
  AnswerSchema,
  ScenarioSchema,
  type Analysis,
  type Answer,
  type AskRequest,
  type Scenario,
} from "./schemas";
import {
  ANALYSIS_SYSTEM_PROMPT,
  ASK_SYSTEM_PROMPT,
  SCENARIO_SYSTEM_PROMPT,
  documentBlock,
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
 * One structured model call. Gemini enforces the JSON schema in
 * response_format; we re-validate with Zod before anything reaches the UI,
 * so malformed AI output can never crash the app.
 */
async function generateStructured<T>(
  system: string,
  input: string,
  schema: z.ZodType<T>,
): Promise<T> {
  let outputText: string | undefined;
  try {
    const interaction = await client.interactions.create({
      model: MODEL,
      input,
      system_instruction: system,
      response_format: { type: "text", mime_type: "application/json", schema: toGeminiSchema(schema) },
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
}

/** One structured call: summary, clauses, obligations, concerns, questions, steps. */
export function analyzeDocument(documentText: string): Promise<Analysis> {
  return generateStructured(ANALYSIS_SYSTEM_PROMPT, documentBlock(documentText), AnalysisSchema);
}

/**
 * Grounded follow-up: a direct question or a "what if?" scenario, each one
 * focused call reusing the already-extracted document text.
 */
export function askQuestion(request: AskRequest): Promise<Answer | Scenario> {
  const input = [documentBlock(request.documentText), `Question: ${request.question}`]
    .filter(Boolean)
    .join("\n\n");
  if (request.mode === "scenario") {
    return generateStructured(SCENARIO_SYSTEM_PROMPT, input, ScenarioSchema);
  }
  const history = request.history
    .map((turn) => `Reader previously asked: ${turn.question}\nYou answered: ${turn.answer}`)
    .join("\n\n");
  return generateStructured(
    ASK_SYSTEM_PROMPT,
    [history, input].filter(Boolean).join("\n\n"),
    AnswerSchema,
  );
}
