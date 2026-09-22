/**
 * Every numeric limit the request path enforces, in one dependency-free
 * module. It deliberately imports nothing: `lib/schemas.ts` (which client
 * components pull in) can use these values without dragging the PDF/DOCX
 * parsers into a browser bundle.
 */

/** Uploaded file ceiling. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Extracted text must be at least this long to be worth analysing. */
export const MIN_TEXT_CHARS = 200;

/** Extracted text ceiling — ~30K tokens, bounding the cost of one analysis. */
export const MAX_TEXT_CHARS = 120_000;

/** Follow-up questions and scenarios are answered from a bounded slice of the
 *  document rather than the whole of it (see boundDocumentContext). */
export const MAX_ASK_CONTEXT_CHARS = 60_000;

/** Longest single question a reader can ask. */
export const MAX_QUESTION_CHARS = 1_000;

/** A prior turn replayed into a follow-up request. The client re-sends model
 *  answers it received, so this bound has to match what it may send back —
 *  otherwise a long answer makes every later question in the view fail. */
export const MAX_HISTORY_ANSWER_CHARS = 4_000;

/** JSON endpoints (`/api/ask`, `/api/case`). Document text is capped at
 *  MAX_TEXT_CHARS, so any valid body is far below this. */
export const MAX_JSON_BODY_BYTES = 512 * 1024;

/** `/api/analyze`: one MAX_FILE_BYTES file plus multipart framing. */
export const MAX_MULTIPART_BODY_BYTES = MAX_FILE_BYTES + 256 * 1024;

/**
 * True when the request declares a body larger than `max`.
 *
 * Content-Length is advisory — a client can omit it or lie — so this is a
 * cheap early rejection for the honest oversized case, not the enforcement
 * point. The schema caps and the file-size check remain the real limits.
 */
export function bodyTooLarge(
  request: { headers: { get(name: string): string | null } },
  max: number,
): boolean {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const bytes = Number(raw);
  return Number.isFinite(bytes) && bytes > max;
}
