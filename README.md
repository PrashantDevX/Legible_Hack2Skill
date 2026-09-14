# Legible

**Understand any legal document before you sign it.** Legible turns a lease, employment contract, or agreement into a plain-language brief — key clauses, what you're agreeing to, possible concerns, and the exact questions to ask a lawyer — with every finding traced back to a quote from your own document.

## The problem

People sign legal documents they don't fully understand — leases, offer letters, freelance contracts, terms of service. The language is dense, the stakes are real, and most people can't afford to pay a lawyer to read every document. The hardest part isn't reading the words; it's knowing **what to worry about, what to ask, and whether to get help** before signing.

## Target users

People without legal training facing a consequential document:

- Renters signing a lease
- New hires reviewing an employment contract or offer letter
- Freelancers and small-business owners sent a client agreement
- Consumers facing binding terms of service or settlement paperwork

## The solution — one coherent workflow

```
Upload (PDF / DOCX / TXT) or paste text
   ↓  validated, extracted, normalized, capped
ONE structured AI analysis
   ↓
Consultation-ready brief — saved to this browser's history
   ├── Plain summary: what am I being asked to agree to?
   ├── Key clauses — each with a verbatim quote
   ├── Obligations: what must I do / what do I get?
   ├── Potential concerns — flagged low / medium / high
   ├── Questions to ask a lawyer — specific, ready to use
   └── Possible next steps — practical, non-binding
   ↓
Grounded follow-up Q&A — answers only from the document,
   with "the document doesn't say" when it doesn't
```

**The differentiator is trust through traceability.** Every clause, obligation, and concern carries a quote from the user's own document — and the server independently **verifies each quote appears in the text** before the UI renders it. Verified quotes are badged ✓; anything the model paraphrased is visibly marked. The output isn't just a summary — it's a preparation sheet that turns a confused reader into an informed client who can use a legal consultation (often free) efficiently.

## GenAI architecture

- **Provider:** Google Gemini API via the `@google/genai` SDK — `gemini-3.5-flash-lite` by default (500 requests/day on the free tier; override with `GEMINI_MODEL`)
- **Structured output:** each analysis is **one** `interactions.create` call with `response_format: { type: "text", mime_type: "application/json", schema }`, where the schema is our Zod schema converted to JSON Schema. One call produces summary, clauses, obligations, concerns, questions, and steps — no per-section calls.
- **Validation:** Gemini enforces the JSON schema; the response is then **re-validated with Zod** before anything reaches the UI. Unparseable or schema-invalid output returns a clean error; SDK errors (`ApiError`) are mapped to safe messages (rate limit, auth, 5xx). Malformed AI output can never crash the app.
- **Grounding:** beyond schema validation, every returned quote is checked against the extracted text (`verifyQuotes`, whitespace-normalized substring match). The UI distinguishes verified quotes from AI paraphrases.
- **Document processing:** PDF via `pdf-parse`, DOCX via `mammoth`, TXT read directly. Text is normalized (line endings, blank lines) and capped at 120,000 characters to bound cost and latency per request.
- **Privacy:** `store: false` on every model call — requests and responses are not retained on Google's side. Analyzed documents and their briefs are saved only to the user's own browser (localStorage) so the history survives a refresh; nothing is written to any server, and each entry can be deleted from the documents list.
- **Prompt-injection defense:** document text is wrapped in `<document>` tags and the system instruction tells the model to treat it strictly as untrusted data — instructions inside a document ("ignore previous instructions…") are ignored and analyzed as text. Both defenses are pinned by tests.

## Technology stack

Next.js (App Router) · TypeScript · React · Tailwind CSS v4 · `@google/genai` · Zod · `pdf-parse` · `mammoth` · Vitest

Every dependency earns its place; there is no database, no vector store, and no additional service. Extracted-document analysis at this size does not need retrieval infrastructure.

## Security

- **Secrets:** the API key lives only in `.env` (git-ignored); `.env.example` documents it. No key is ever sent to the browser.
- **File validation:** extension allow-list (PDF/DOCX/TXT/MD), 5 MB cap, empty-file rejection — all *before* parsing.
- **Input validation:** all request payloads parsed with Zod (question length, history cap, document size); text paths enforce a 200-character minimum so no AI call is made without meaningful input.
- **Prompt injection:** documents are untrusted data (see GenAI architecture).
- **Privacy:** no database, no file storage, no logging of document content. Documents live in request memory only; the extracted text is returned to the same client that uploaded it so follow-up questions can be grounded. Saved history is browser-local, capped at 20 documents, and best-effort — if storage is blocked the app still works.
- **Safe errors:** API failures map to short user-facing messages; internals are never leaked.

## Efficiency

- **One model call per analysis** — summary, clauses, obligations, concerns, questions, and steps come from a single structured response, not six calls.
- **One user action = exactly one API call** — the SDK's default 5-attempt retry loop is disabled; a failed request surfaces immediately as a clean message instead of silently re-billing input tokens.
- **No AI call without meaningful input** — a 200-character minimum on all input paths.
- **Bounded context** — extracted text is capped at 120,000 characters per request.
- **No duplicate work** — extraction happens once per document; Q&A reuses the client-held text; there is no polling or background processing.
- **Minimal footprint** — no database, no vector store, six runtime dependencies.

## Testing

`npm test` — 25 unit tests (Vitest) covering the highest-risk logic:

- File validation: allowed types, rejected extensions, oversized and empty files
- Text normalization and the truncation path for oversized documents
- The grounding check: exact, whitespace-variant, ellipsis-abbreviated, absent, and empty quotes
- Request schema: valid, empty, too-short, oversized, and over-history requests
- Local history: round-trip, newest-first ordering, 20-entry cap, deletion, corrupt/blocked storage fallback
- Prompt-injection defenses: `<document>` delimiters and the untrusted-data instructions in both system prompts

## Accessibility

Semantic HTML with labeled regions and headings; `sr-only` labels on icon-only inputs; `role="status"`/`role="alert"` live regions for loading and errors; visible focus outlines on all interactive elements; `aria-pressed` toggle buttons for input mode; responsive single-column layout that works at phone width; plain language throughout. A dark theme is available via the header toggle (choice is remembered; defaults to the system preference, applied before first paint), and all colors meet contrast requirements in both themes.

## Setup

```bash
npm install
cp .env.example .env   # then set GEMINI_API_KEY (free at aistudio.google.com/apikey)
npm run dev            # http://localhost:3000
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Gemini API key, server-side only |
| `GEMINI_MODEL` | no | Model override (default `gemini-3.5-flash-lite`) |

## Deployment

Any Node host. On Vercel: import the repo, set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) as environment variables, deploy. No other infrastructure is needed.

```
npm run build   # production build
npm start       # production server
npm test        # test suite
```

## Legal disclaimer

Legible provides **informational assistance to help you read and understand documents**. It is not a lawyer, does not provide legal advice, and does not replace consultation with a qualified legal professional. It may miss issues or misread passages. Analyses use cautious language ("may", "consider asking a professional") by design, and the product never claims a document is legal or illegal or predicts outcomes. Always consult a licensed professional before making legal decisions.
