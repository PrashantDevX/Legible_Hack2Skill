import { beforeEach, describe, expect, it } from "vitest";
import {
  AI_CACHE_MAX_ENTRIES,
  AI_CACHE_TTL_MS,
  aiCacheSize,
  cacheKey,
  cached,
  clearAiCache,
} from "../lib/ai-cache";

/**
 * The cache exists to make repeated user actions free. These tests pin the
 * properties that guarantee that, and the ones that keep it from becoming a
 * correctness or memory problem.
 */

beforeEach(() => {
  clearAiCache();
});

describe("cacheKey", () => {
  it("is stable for the same operation and input", () => {
    expect(cacheKey("answer", "what is the late fee?")).toBe(
      cacheKey("answer", "what is the late fee?"),
    );
  });

  it("separates different inputs and different operations", () => {
    expect(cacheKey("answer", "q1")).not.toBe(cacheKey("answer", "q2"));
    // The same text asked as a scenario must not reuse the answer.
    expect(cacheKey("answer", "q1")).not.toBe(cacheKey("scenario", "q1"));
  });
});

describe("cached", () => {
  it("runs the producer once for repeated identical requests", async () => {
    let calls = 0;
    const produce = async () => {
      calls++;
      return "result";
    };
    expect(await cached("ask:q", produce)).toBe("result");
    expect(await cached("ask:q", produce)).toBe("result");
    expect(await cached("ask:q", produce)).toBe("result");
    expect(calls).toBe(1);
  });

  it("runs the producer again for a different request", async () => {
    let calls = 0;
    const produce = async () => {
      calls++;
      return calls;
    };
    await cached("a", produce);
    await cached("b", produce);
    expect(calls).toBe(2);
  });

  it("shares one in-flight request between concurrent identical calls", async () => {
    let started = 0;
    let release: (value: string) => void = () => {};
    const gate = new Promise<string>((resolve) => {
      release = resolve;
    });
    const produce = () => {
      started++;
      return gate; // a double-click while the first call is still running
    };

    const first = cached("inflight", produce);
    const second = cached("inflight", produce);
    release("shared");

    expect(await first).toBe("shared");
    expect(await second).toBe("shared");
    expect(started).toBe(1);
  });

  it("serves a hit within the TTL and refetches once it has passed", async () => {
    let calls = 0;
    const produce = async () => {
      calls++;
      return calls;
    };
    await cached("ttl", produce, 0);
    expect(await cached("ttl", produce, AI_CACHE_TTL_MS - 1)).toBe(1); // still fresh
    expect(await cached("ttl", produce, AI_CACHE_TTL_MS)).toBe(2); // expired
    expect(calls).toBe(2);
  });

  it("does not cache a failure, so a retry can succeed", async () => {
    let attempts = 0;
    const produce = async () => {
      attempts++;
      if (attempts === 1) throw new Error("provider unavailable");
      return "recovered";
    };
    await expect(cached("failing", produce)).rejects.toThrow("provider unavailable");
    expect(await cached("failing", produce)).toBe("recovered");
    expect(attempts).toBe(2);
  });

  it("bounds how many results it retains", async () => {
    for (let i = 0; i < AI_CACHE_MAX_ENTRIES + 5; i++) {
      await cached(`key-${i}`, async () => i);
    }
    expect(aiCacheSize()).toBe(AI_CACHE_MAX_ENTRIES);

    // The oldest entries were evicted, so they are produced again rather than
    // growing the map without limit.
    let reproduced = false;
    await cached("key-0", async () => {
      reproduced = true;
      return 0;
    });
    expect(reproduced).toBe(true);
  });
});

/**
 * Repeated Q&A: the properties the follow-up panel depends on. Asking the same
 * thing again about the same document must not become a second model call, and
 * a genuine follow-up (different question, or new history) must not collide
 * with the question before it.
 */
describe("repeated Q&A keys", () => {
  const keyFor = (documentText: string, question: string, history: unknown[] = []) =>
    cacheKey("answer", JSON.stringify({ documentText, question, history }));

  it("treats a repeated question on the same document as one request", () => {
    const first = keyFor("lease text", "What is the late fee?");
    const second = keyFor("lease text", "What is the late fee?");
    expect(first).toBe(second);
  });

  it("does not collide across documents or questions", () => {
    expect(keyFor("lease A", "What is the late fee?")).not.toBe(
      keyFor("lease B", "What is the late fee?"),
    );
    expect(keyFor("lease text", "What is the late fee?")).not.toBe(
      keyFor("lease text", "Can I sublet?"),
    );
  });

  it("treats a follow-up carrying new history as a different request", () => {
    const prior = [{ question: "What is the late fee?", answer: "₹500 per day." }];
    expect(keyFor("lease text", "Can I sublet?")).not.toBe(
      keyFor("lease text", "Can I sublet?", prior),
    );
  });
});
