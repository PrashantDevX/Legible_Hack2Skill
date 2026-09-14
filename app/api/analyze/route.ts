import { NextRequest, NextResponse } from "next/server";
import { analyzeDocument, AiError } from "@/lib/ai";
import { DocumentError, extractText, validateFile } from "@/lib/document";
import { verifyQuotes } from "@/lib/document";
import type { Analysis } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST multipart/form-data with either `file` (PDF/DOCX/TXT/MD) or `text`.
 * Returns the structured analysis plus a per-item grounding check marking
 * which quotes were verified verbatim in the extracted document text.
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const pasted = form.get("text");

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

    const analysis = await analyzeDocument(text);

    // Grounding: verify every quote the model returned actually appears in
    // the document, so the UI can distinguish verified from unverified items.
    const analysisWithProof: Analysis & {
      quotesVerified: { clauses: boolean[]; obligations: boolean[]; concerns: boolean[] };
    } = {
      ...analysis,
      quotesVerified: {
        clauses: verifyQuotes(text, analysis.keyClauses.map((c) => c.quote)),
        obligations: verifyQuotes(text, analysis.obligations.map((o) => o.quote)),
        concerns: verifyQuotes(text, analysis.concerns.map((c) => c.quote)),
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
