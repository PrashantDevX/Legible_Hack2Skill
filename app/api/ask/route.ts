import { NextRequest, NextResponse } from "next/server";
import { askQuestion, AiError } from "@/lib/ai";
import { findPages, verifyQuotes } from "@/lib/document";
import { AskRequestSchema } from "@/lib/schemas";
import { AI_RATE_LIMIT, AI_RATE_WINDOW_MS, clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST JSON { documentText, question, history, situation? } — grounded Q&A
 *  over one document. */
export async function POST(request: NextRequest) {
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

    const result = await askQuestion(parsed.data);

    if ("scenario" in result) {
      const scenario = result.scenario;
      return NextResponse.json({
        answer: {
          ...scenario,
          sourceVerified: verifyQuotes(parsed.data.documentText, [scenario.source])[0],
          page: findPages(parsed.data.documentText, [scenario.source])[0],
        },
      });
    }

    const answer = result.answer;
    const quotesVerified = verifyQuotes(
      parsed.data.documentText,
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
