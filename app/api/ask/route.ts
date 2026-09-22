import { NextRequest, NextResponse } from "next/server";
import { askQuestion, AiError } from "@/lib/ai";
import { OMITTED_NOTE, boundDocumentContext, findPages, verifyQuotes } from "@/lib/document";
import { MAX_JSON_BODY_BYTES, bodyTooLarge } from "@/lib/limits";
import { AskRequestSchema } from "@/lib/schemas";
import { AI_RATE_LIMIT, AI_RATE_WINDOW_MS, clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST JSON { documentText, question, history, situation? } — grounded Q&A
 *  over one document. */
export async function POST(request: NextRequest) {
  if (bodyTooLarge(request, MAX_JSON_BODY_BYTES)) {
    return NextResponse.json({ error: "That request is too large." }, { status: 413 });
  }
  if (!rateLimit(`ai:${clientIp(request)}`, AI_RATE_LIMIT, AI_RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      { status: 429 },
    );
  }
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const parsed = AskRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    // Bound the context once and use exactly this text for both the model call
    // and quote verification, so a finding can never be marked verified
    // against a passage the model was not shown.
    const bounded = boundDocumentContext(parsed.data.documentText);
    const result = await askQuestion(
      { ...parsed.data, documentText: bounded.text },
      bounded.omitted ? OMITTED_NOTE : undefined,
    );

    if ("scenario" in result) {
      const scenario = result.scenario;
      return NextResponse.json({
        answer: {
          ...scenario,
          sourceVerified: verifyQuotes(bounded.text, [scenario.source])[0],
          page: findPages(bounded.text, [scenario.source])[0],
        },
      });
    }

    const answer = result.answer;
    const quotesVerified = verifyQuotes(
      bounded.text,
      answer.supportingQuotes.map((q) => q.quote),
    );
    return NextResponse.json({ answer: { ...answer, quotesVerified } });
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("ask failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not answer. Please try again." }, { status: 500 });
  }
}
