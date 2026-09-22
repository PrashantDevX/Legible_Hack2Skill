import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  MAX_JSON_BODY_BYTES,
  MAX_MULTIPART_BODY_BYTES,
  bodyTooLarge,
} from "../lib/limits";

function requestWith(contentLength: string | null) {
  return {
    headers: { get: (name: string) => (name === "content-length" ? contentLength : null) },
  };
}

describe("request body limits", () => {
  it("keeps the multipart ceiling just above the file limit", () => {
    expect(MAX_MULTIPART_BODY_BYTES).toBeGreaterThan(MAX_FILE_BYTES);
    expect(MAX_JSON_BODY_BYTES).toBeLessThan(MAX_MULTIPART_BODY_BYTES);
  });

  it("allows a body up to and including the limit", () => {
    expect(bodyTooLarge(requestWith("0"), MAX_JSON_BODY_BYTES)).toBe(false);
    expect(bodyTooLarge(requestWith(String(MAX_JSON_BODY_BYTES)), MAX_JSON_BODY_BYTES)).toBe(false);
  });

  it("rejects a declared body over the limit", () => {
    expect(bodyTooLarge(requestWith(String(MAX_JSON_BODY_BYTES + 1)), MAX_JSON_BODY_BYTES)).toBe(
      true,
    );
    // A 50 MB upload is refused before it is buffered, rather than after the
    // 5 MB file check runs.
    expect(bodyTooLarge(requestWith(String(50 * 1024 * 1024)), MAX_MULTIPART_BODY_BYTES)).toBe(true);
  });

  it("defers to the schema caps when the length is missing or unreadable", () => {
    // Content-Length is advisory — a client can omit it or lie — so an absent
    // or non-numeric value must not be treated as oversized. The Zod caps and
    // the file-size check remain the enforcement point.
    expect(bodyTooLarge(requestWith(null), MAX_JSON_BODY_BYTES)).toBe(false);
    expect(bodyTooLarge(requestWith("not-a-number"), MAX_JSON_BODY_BYTES)).toBe(false);
  });
});
