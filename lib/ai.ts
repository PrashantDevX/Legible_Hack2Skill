import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  AnalysisSchema,
  AnswerSchema,
  type Analysis,
  type Answer,
  type AskRequest,
} from "./schemas";
import { ANALYSIS_SYSTEM_PROMPT, ASK_SYSTEM_PROMPT, documentBlock } from "./prompts";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

/** Map SDK errors to safe, user-facing messages (no internal detail leaks). */
function toAiError(error: unknown): AiError {
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError("The service is busy right now. Please try again in a moment.", 429);
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new AiError("The AI service is not configured correctly on the server.", 500);
  }
  if (error instanceof Anthropic.APIError && error.status && error.status >= 500) {
    return new AiError("The AI service is temporarily unavailable. Please try again.", 502);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError("Could not reach the AI service. Check your connection and retry.", 502);
  }
  return new AiError("Analysis failed. Please try again.", 502);
}

/** One structured call: summary, clauses, obligations, concerns, questions, steps. */
export async function analyzeDocument(documentText: string): Promise<Analysis> {
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: documentBlock(documentText) }],
      output_config: { format: zodOutputFormat(AnalysisSchema) },
    });
    if (!response.parsed_output) {
      throw new AiError("The AI returned an unreadable response. Please try again.");
    }
    return response.parsed_output;
  } catch (error) {
    throw error instanceof AiError ? error : toAiError(error);
  }
}

/**
 * Grounded Q&A. The document sits in the cached system prefix so follow-up
 * questions reuse it instead of re-billing (and re-sending) the full text.
 */
export async function askQuestion(request: AskRequest): Promise<Answer> {
  const messages: Anthropic.MessageParam[] = [];
  for (const turn of request.history) {
    messages.push({ role: "user", content: turn.question });
    messages.push({ role: "assistant", content: turn.answer });
  }
  messages.push({ role: "user", content: request.question });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: [
        { type: "text", text: ASK_SYSTEM_PROMPT },
        // Cached block: the document is stable across a conversation's
        // questions, so follow-ups read it from cache instead of re-billing.
        { type: "text", text: documentBlock(request.documentText), cache_control: { type: "ephemeral" } },
      ],
      messages,
      output_config: { format: zodOutputFormat(AnswerSchema) },
    });
    if (!response.parsed_output) {
      throw new AiError("The AI returned an unreadable response. Please try again.");
    }
    return response.parsed_output;
  } catch (error) {
    throw error instanceof AiError ? error : toAiError(error);
  }
}
