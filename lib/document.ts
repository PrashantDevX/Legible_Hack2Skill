import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { MAX_ASK_CONTEXT_CHARS, MAX_FILE_BYTES, MAX_TEXT_CHARS, MIN_TEXT_CHARS } from "./limits";

/**
 * Document extraction and limits. Files are validated (extension, size,
 * signature, container structure), extracted to plain text, normalized, and
 * capped before anything is sent to the model. No document content is
 * persisted or logged.
 *
 * The numeric limits live in `lib/limits.ts` (dependency-free) and are
 * re-exported here for callers that already import this module.
 */

export { MAX_ASK_CONTEXT_CHARS, MAX_FILE_BYTES, MAX_TEXT_CHARS, MIN_TEXT_CHARS };

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md"]);

/** Marks the dropped middle so the model never reads the two halves as one. */
const OMISSION_MARKER = "\n\n[middle portion of this document omitted]\n\n";

export class DocumentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export type ExtractResult = {
  text: string;
  truncated: boolean;
};

export function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/** Validate filename/extension and byte size before any parsing. */
export function validateFile(filename: string, bytes: number): void {
  if (!ALLOWED_EXTENSIONS.has(extensionOf(filename))) {
    throw new DocumentError(
      `Unsupported file type ".${extensionOf(filename) || "unknown"}". Allowed: PDF, DOCX, TXT, MD.`,
    );
  }
  if (bytes > MAX_FILE_BYTES) {
    throw new DocumentError(
      `File is ${(bytes / 1024 / 1024).toFixed(1)} MB. Maximum size is 5 MB.`,
    );
  }
  if (bytes === 0) throw new DocumentError("File is empty.");
}

/**
 * Content validation: the file's leading bytes must match its extension's
 * real signature, and the container must have the structure its parser needs,
 * so a renamed or malformed file never reaches a parser.
 * Plain-text formats (txt/md) have no signature and are skipped.
 */
export function validateFileSignature(filename: string, buffer: Buffer): void {
  const ext = extensionOf(filename);
  if (ext === "pdf") {
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new DocumentError("This file does not appear to be a valid PDF. If it is a scan or image, paste the text instead.");
    }
    // A conformant PDF ends with a %%EOF trailer. Only checked once the file is
    // large enough to have one, so small synthetic fixtures are unaffected.
    if (buffer.length >= 1024 && !buffer.subarray(-2048).includes("%%EOF")) {
      throw new DocumentError("This PDF appears to be incomplete or damaged — try another file or paste the text instead.");
    }
  }
  if (ext === "docx") {
    // DOCX is a zip archive — every zip variant starts with "PK".
    if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
      throw new DocumentError("This file does not appear to be a valid Word (DOCX) document.");
    }
    // ...and a Word package must contain its main document part. Entry names
    // appear literally in the zip's headers, so a byte search is enough and
    // rejects an unrelated archive renamed to .docx.
    if (!buffer.includes("word/document.xml")) {
      throw new DocumentError(
        "This file is an archive, but not a Word document. Save it as .docx and try again.",
      );
    }
  }
}

/**
 * Sent alongside the bounded text whenever `omitted` is true. Without it the
 * model would read the head and tail as contiguous text and could answer as
 * though the omitted middle did not exist.
 */
export const OMITTED_NOTE =
  "The document below is not complete: a middle portion was omitted because the document is long. " +
  "If answering depends on an omitted part, say the provided text does not cover it rather than guessing.";

/**
 * Bound the document text sent with a follow-up question, scenario, or draft. A
 * large document is reduced to its head and tail rather than its head alone: the
 * opening carries the parties, term and definitions, and the closing carries
 * signatures, schedules and exhibits — where blanks and incomplete fields
 * tend to live.
 *
 * The omission is marked inline (so the model never reads the two halves as
 * contiguous) and reported to the caller. Quotes are verified against this
 * same bounded text, so a finding can never be marked verified against a
 * passage the model was never given.
 */
export function boundDocumentContext(
  text: string,
  limit: number = MAX_ASK_CONTEXT_CHARS,
): { text: string; omitted: boolean } {
  if (text.length <= limit) return { text, omitted: false };
  // Reserve room for the marker so `limit` stays a true ceiling on what is
  // actually sent, not just on the retained document text.
  const budget = limit - OMISSION_MARKER.length;
  if (budget <= 0) return { text: text.slice(0, limit), omitted: true };
  const head = Math.floor(budget * 0.75);
  const tail = budget - head;
  return {
    text: `${text.slice(0, head)}${OMISSION_MARKER}${text.slice(-tail)}`,
    omitted: true,
  };
}

/** Collapse Windows line endings and excessive blank lines; trim. */
export function normalizeText(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Extract text, normalize, and cap at MAX_TEXT_CHARS. Parser failures are
 *  wrapped as DocumentError so corrupt files surface as clean 400s. */
export async function extractText(filename: string, buffer: Buffer): Promise<ExtractResult> {
  const ext = extensionOf(filename);
  validateFileSignature(filename, buffer);
  let raw: string;
  try {
    if (ext === "pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        raw = result.text;
      } finally {
        await parser.destroy();
      }
    } else if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      raw = result.value;
    } else {
      raw = buffer.toString("utf8");
    }
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    console.error("extraction failed:", error instanceof Error ? error.message : error);
    throw new DocumentError(
      "This file could not be read. It may be corrupt or password-protected — try another file or paste the text instead.",
    );
  }

  const text = normalizeText(raw);
  if (text.length < MIN_TEXT_CHARS) {
    throw new DocumentError(
      "Could not read enough text from this file. If it is a scanned document, paste the text instead.",
    );
  }
  return {
    text: text.slice(0, MAX_TEXT_CHARS),
    truncated: text.length > MAX_TEXT_CHARS,
  };
}

/**
 * Grounding check: for each AI-returned quote, does it appear (modulo
 * whitespace) in the source text? Used to mark findings as verified.
 */
export function normalizeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function verifyQuotes(source: string, quotes: string[]): boolean[] {
  const haystack = normalizeForMatch(source);
  return quotes.map((q) => {
    // Models often abbreviate long passages with "..." — verify each fragment
    // between ellipses rather than the whole string, so an abbreviated (but
    // genuine) passage still counts as verified.
    const fragments = normalizeForMatch(q)
      .split(/(?:\.{3}|…)+/)
      .map((fragment) => fragment.trim())
      .filter(Boolean);
    return fragments.length > 0 && fragments.every((f) => haystack.includes(f));
  });
}

/**
 * Page numbers for quotes, from the page markers ("-- 2 of 5 --") the PDF
 * extractor appends after each page's text. Returns null per quote when the
 * source has no page markers (pasted text, DOCX) or the quote isn't found —
 * we never guess a page number.
 */
export function findPages(source: string, quotes: string[]): (number | null)[] {
  const normalized = normalizeForMatch(source);
  const markers = [...normalized.matchAll(/--\s*(\d+)\s+of\s+\d+\s*--/g)].map((m) => ({
    page: Number(m[1]),
    end: (m.index ?? 0) + m[0].length,
  }));
  if (markers.length === 0) return quotes.map(() => null);
  return quotes.map((q) => {
    // Locate by the quote's first ellipsis-free fragment (abbreviated quotes
    // are not contiguous in the source).
    const first = normalizeForMatch(q)
      .split(/(?:\.{3}|…)+/)[0]
      .trim();
    const at = first ? normalized.indexOf(first) : -1;
    if (at === -1) return null;
    // A page's text precedes its marker, so the quote belongs to the first
    // marker at or after its position.
    const marker = markers.find((m) => m.end > at);
    return marker ? marker.page : null;
  });
}
