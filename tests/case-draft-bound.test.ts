import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { MAX_ASK_CONTEXT_CHARS, MAX_TEXT_CHARS } from "../lib/limits";
import { OMITTED_NOTE } from "../lib/document";

/**
 * The draft path sends document text to the model, so it must apply the same
 * context bound as the follow-up path. Only the model call is mocked — the
 * route, the request schema and the bounding all run for real, so this fails
 * if the bound is ever dropped from the draft branch.
 */

const ai = vi.hoisted(() => ({
  draftCommunication: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    draftText: "draft",
    basedOn: [],
  })),
  askIntakeQuestions: vi.fn(),
  buildCaseBrief: vi.fn(),
}));

vi.mock("@/lib/ai", () => ({
  AiError: class AiError extends Error {},
  askIntakeQuestions: ai.askIntakeQuestions,
  buildCaseBrief: ai.buildCaseBrief,
  draftCommunication: ai.draftCommunication,
}));

import { POST } from "../app/api/case/route";

const PROBLEM = "My landlord is refusing to return my security deposit after I vacated the flat.";

function draftRequest(documentText?: string): NextRequest {
  return new Request("http://localhost/api/case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "draft",
      problem: PROBLEM,
      answers: [],
      draftType: "written-request",
      ...(documentText === undefined ? {} : { documentText }),
    }),
  }) as unknown as NextRequest;
}

/** The arguments the draft branch passed to the model call. */
function draftCall() {
  expect(ai.draftCommunication).toHaveBeenCalledTimes(1);
  return ai.draftCommunication.mock.calls[0] as [
    string,
    unknown[],
    string,
    string | undefined,
    string | undefined,
  ];
}

beforeEach(() => {
  ai.draftCommunication.mockClear();
});

describe("draft document context bound", () => {
  it("never sends more than MAX_ASK_CONTEXT_CHARS to the draft call", async () => {
    // Longer than the context bound but within the extraction cap, so the
    // request is valid and only the drafting path's own bound applies.
    const long = "x".repeat(MAX_ASK_CONTEXT_CHARS + 5_000);
    expect(long.length).toBeLessThanOrEqual(MAX_TEXT_CHARS);

    const response = await POST(draftRequest(long));
    expect(response.status).toBe(200);

    const [, , , documentText, contextNote] = draftCall();
    expect(documentText).toBeDefined();
    expect(documentText!.length).toBeLessThanOrEqual(MAX_ASK_CONTEXT_CHARS);
    // The model is told the middle is missing rather than reading the two
    // halves as contiguous text — the same note the follow-up path uses.
    expect(documentText).toContain("middle portion of this document omitted");
    expect(contextNote).toBe(OMITTED_NOTE);
  });

  it("keeps the head and tail of a long document, where the terms and blanks live", async () => {
    const head = "1. TERM. The tenancy is for 11 months.";
    const tail = "7. Signature. Date: ______________";
    const long = head + "x".repeat(MAX_ASK_CONTEXT_CHARS + 5_000) + tail;

    await POST(draftRequest(long));

    const [, , , documentText] = draftCall();
    expect(documentText!.startsWith(head)).toBe(true);
    expect(documentText!.endsWith(tail)).toBe(true);
  });

  it("passes a normal short document through unchanged, with no note", async () => {
    const lease =
      "RESIDENTIAL RENTAL AGREEMENT. Rent is Rs 25,000 monthly. " +
      "The deposit of Rs 75,000 is refundable on vacating.";

    await POST(draftRequest(lease));

    const [problem, , draftType, documentText, contextNote] = draftCall();
    expect(problem).toBe(PROBLEM);
    expect(draftType).toBe("written-request");
    expect(documentText).toBe(lease);
    expect(contextNote).toBeUndefined();
  });

  it("sends no document and no note when the draft has no document attached", async () => {
    await POST(draftRequest());

    const [, , , documentText, contextNote] = draftCall();
    expect(documentText).toBeUndefined();
    expect(contextNote).toBeUndefined();
  });
});
