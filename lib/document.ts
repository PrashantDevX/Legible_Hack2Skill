import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

/**
 * Document extraction and limits. Files are validated (extension, size),
 * extracted to plain text, normalized, and capped before anything is sent
 * to the model. No document content is persisted or logged.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MIN_TEXT_CHARS = 200;
export const MAX_TEXT_CHARS = 120_000; // ~30K tokens — bounded AI cost per request

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md"]);

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
 * real signature, so a renamed arbitrary file never reaches a parser.
 * Plain-text formats (txt/md) have no signature and are skipped.
 */
export function validateFileSignature(filename: string, buffer: Buffer): void {
  const ext = extensionOf(filename);
  if (ext === "pdf" && buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new DocumentError("This file does not appear to be a valid PDF. If it is a scan or image, paste the text instead.");
  }
  if (ext === "docx" && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    // DOCX is a zip archive — every zip variant starts with "PK".
    throw new DocumentError("This file does not appear to be a valid Word (DOCX) document.");
  }
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
