import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  AnalysisSchema,
  AnswerSchema,
  type Analysis,
  type Answer,
  type AskRequest,
} from "./schemas";
import { ANALYSIS_SYSTEM_PROMPT, ASK_SYSTEM_PROMPT, documentBlock } from "./prompts";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

/** Map SDK errors to safe, user-facing messages (no internal detail leaks). */
function toAiError(error: unknown): AiError {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new AiError("The service is busy right now. Please try again in a moment.", 429);
    }
    if (error.status === 401 || error.status === 403) {
      return new AiError("The AI service is not configured correctly on the server.", 500);
    }
    if (error.status >= 500) {
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

/** Grounded Q&A: answer only from the document, with verbatim supporting quotes. */
export function askQuestion(request: AskRequest): Promise<Answer> {
  const history = request.history
    .map((turn) => `Reader previously asked: ${turn.question}\nYou answered: ${turn.answer}`)
    .join("\n\n");
  const input = [
    history,
    documentBlock(request.documentText),
    `Question: ${request.question}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return generateStructured(ASK_SYSTEM_PROMPT, input, AnswerSchema);
}
