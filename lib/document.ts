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

/** Collapse Windows line endings and excessive blank lines; trim. */
export function normalizeText(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Extract text, normalize, and cap at MAX_TEXT_CHARS. */
export async function extractText(filename: string, buffer: Buffer): Promise<ExtractResult> {
  const ext = extensionOf(filename);
  let raw: string;
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
    const needle = normalizeForMatch(q);
    return needle.length > 0 && haystack.includes(needle);
  });
}
