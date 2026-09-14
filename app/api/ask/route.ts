import { NextRequest, NextResponse } from "next/server";
import { askQuestion, AiError } from "@/lib/ai";
import { verifyQuotes } from "@/lib/document";
import { AskRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST JSON { documentText, question, history } — grounded Q&A over one document. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AskRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const answer = await askQuestion(parsed.data);
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
