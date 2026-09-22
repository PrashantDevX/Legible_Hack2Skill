import { NextRequest, NextResponse } from "next/server";
import { AiError, askIntakeQuestions, buildCaseBrief, draftCommunication } from "@/lib/ai";
import { OMITTED_NOTE, boundDocumentContext } from "@/lib/document";
import { MAX_JSON_BODY_BYTES, bodyTooLarge } from "@/lib/limits";
import { CaseRequestSchema } from "@/lib/schemas";
import { AI_RATE_LIMIT, AI_RATE_WINDOW_MS, clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST JSON — the three case AI operations, one structured call each:
 *   { mode: "intake",  problem }
 *   { mode: "brief",   problem, answers, documentFindings }
 *   { mode: "draft",   problem, answers, draftType, documentText? }
 */
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
    const parsed = CaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    if (parsed.data.mode === "intake") {
      const questions = await askIntakeQuestions(parsed.data.problem);
      return NextResponse.json({ questions });
    }

    if (parsed.data.mode === "brief") {
      const brief = await buildCaseBrief(
        parsed.data.problem,
        parsed.data.answers,
        parsed.data.documentFindings,
      );
      return NextResponse.json({ brief });
    }

    // Same bound as the follow-up path: a long document is reduced to head and
    // tail, and the note tells the model the middle is missing so it does not
    // draft as though the omitted part did not exist.
    const bounded = parsed.data.documentText
      ? boundDocumentContext(parsed.data.documentText)
      : null;
    const draft = await draftCommunication(
      parsed.data.problem,
      parsed.data.answers,
      parsed.data.draftType,
      bounded?.text,
      bounded?.omitted ? OMITTED_NOTE : undefined,
    );
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("case failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not process this request. Please try again." }, { status: 500 });
  }
}
