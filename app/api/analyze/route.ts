import { NextRequest, NextResponse } from "next/server";
import { analyzeDocument, AiError } from "@/lib/ai";
import { DocumentError, extractText, findPages, validateFile, verifyQuotes } from "@/lib/document";
import { AI_RATE_LIMIT, AI_RATE_WINDOW_MS, clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
// 60s is the ceiling on Vercel's Hobby plan; a higher value is silently clamped
// there, so this is the honest number. Pro + Fluid compute raises it to 300.
export const maxDuration = 60;

/**
 * POST multipart/form-data with either `file` (PDF/DOCX/TXT/MD) or `text`,
 * plus an optional `situation` field (the user's legal problem) so the
 * analysis can prioritize what matters to it while still covering the whole
 * document. Returns the structured analysis plus a per-item grounding check
 * marking which quotes were verified verbatim in the extracted document text.
 */
export async function POST(request: NextRequest) {
  if (!rateLimit(`ai:${clientIp(request)}`, AI_RATE_LIMIT, AI_RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      { status: 429 },
    );
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    const pasted = form.get("text");
    const situation = form.get("situation");

    let text: string;
    let truncated = false;
    if (file instanceof File && file.size > 0) {
      validateFile(file.name, file.size);
      const extracted = await extractText(file.name, Buffer.from(await file.arrayBuffer()));
      text = extracted.text;
      truncated = extracted.truncated;
    } else if (typeof pasted === "string" && pasted.trim().length >= 200) {
      text = pasted.trim().slice(0, 120_000);
      truncated = pasted.length > 120_000;
    } else {
      return NextResponse.json(
        { error: "Upload a document (PDF, DOCX, TXT) or paste at least 200 characters of text." },
        { status: 400 },
      );
    }

    // Case context (bounded; user input, never trusted instructions).
    const context = typeof situation === "string" ? situation.trim().slice(0, 2000) : undefined;
    const analysis = await analyzeDocument(text, context || undefined);

    // Grounding: verify every quote the model returned actually appears in
    // the document, and locate it on a page when the extraction produced
    // page markers — so the UI can distinguish verified from unverified items.
    const evidence = {
      clauses: verifyQuotes(text, analysis.keyClauses.map((c) => c.quote)),
      obligations: verifyQuotes(text, analysis.obligations.map((o) => o.quote)),
      concerns: verifyQuotes(text, analysis.concerns.map((c) => c.quote)),
    };
    const asymmetrySources = analysis.partyAsymmetries.flatMap((a) => [a.sourceA, a.sourceB]);
    const analysisWithProof = {
      ...analysis,
      quotesVerified: evidence,
      missingVerified: verifyQuotes(text, analysis.missingInformation.map((m) => m.source)),
      asymmetriesVerified: verifyQuotes(text, asymmetrySources),
      pages: {
        clauses: findPages(text, analysis.keyClauses.map((c) => c.quote)),
        obligations: findPages(text, analysis.obligations.map((o) => o.quote)),
        concerns: findPages(text, analysis.concerns.map((c) => c.quote)),
        missing: findPages(text, analysis.missingInformation.map((m) => m.source)),
        asymmetries: findPages(text, asymmetrySources),
      },
    };

    // Return the extracted text so the client can ground follow-up Q&A
    // (the browser cannot extract PDF/DOCX itself). Nothing is persisted.
    return NextResponse.json({ analysis: analysisWithProof, text, truncated });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("analyze failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
