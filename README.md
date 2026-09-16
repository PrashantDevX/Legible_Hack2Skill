# Legible

**From legal problem to prepared case.** Describe a legal problem in your own words — no legal terms needed — and Legible asks smart clarifying questions, organizes your facts into a structured case brief, identifies the information you're missing, analyzes your documents with your situation in mind, and prepares your next step: a factual communication draft and a consultation-ready brief you can bring to a professional. Every document finding is traced back to a quote from your own document — verified on the server, never just asserted.

## The problem

Most people facing a legal problem — a withheld security deposit, unpaid salary, a refused refund — don't know where to start. They don't know what facts matter, what evidence to keep, what their documents actually say, or what to ask a professional. Legal help is expensive and often assumes you can already state your problem in legal terms. The hardest part isn't getting an answer; it's getting *organized enough to ask*.

At the same time, people sign documents they don't fully understand. Legible helps with both: it is a **legal problem navigator** with a document intelligence engine at its core.

## Target users

People without legal training who are facing a concrete situation:

- Renters whose deposit hasn't been returned (or who are about to sign a lease)
- Employees whose salary is unpaid (or who are reviewing an employment agreement)
- Consumers in a refund or defective-product dispute
- Freelancers and small-business owners sent a client agreement

## The workflow — one coherent journey

```
"My landlord hasn't returned my security deposit."   ← plain words, no legal terms
   ↓ ONE structured AI call
Smart intake: 3–5 clarifying questions generated for THIS situation
   (move-out date? itemized list? written agreement? location? outcome sought?)
   ↓ ONE structured AI call
CASE BRIEF — the central artifact
   ├── Situation summary
   ├── Known facts — every one badged: YOU SAID · FROM DOCUMENT · AI INTERPRETATION
   ├── Parties and amounts
   ├── Timeline (dates exactly as stated; "Date not specified" when unknown — never invented)
   ├── Information gaps — what may help you prepare, why, and how to get it
   └── Possible next steps to consider (practical, non-binding)
   ↓
CASE READINESS — a deterministic, transparent completeness meter
   ("Preparation completeness — not an assessment of legal outcome")
   ↓ attach documents (PDF / DOCX / TXT / paste)
DOCUMENT INTELLIGENCE — the existing engine, focused on the problem
   ├── Plain summary · key clauses · obligations · concerns (low/med/high)
   ├── Missing or incomplete information
   ├── Potential party imbalances
   └── Every finding: "Why was this flagged?" — verified quote, PDF page when
       the file provides one, section (AI-identified, labeled as such)
   ↓
Grounded Q&A + "Explore a scenario" ("What happens if…?") — answers only from
   the document, with "I can't determine that from this document alone" when
   it doesn't say
   ↓
COMMUNICATION DRAFT — a factual, review-before-sending message based only on
   your facts and documents ("AI-generated draft — review carefully")
   ↓
PROFESSIONAL BRIEF — consultation-ready, composed deterministically from your
   case data (no AI call): situation, facts, timeline, documents, findings,
   gaps, questions to ask. Copy or print it.
```

A document-only workflow (upload → analyze) remains available — the analyzer is an engine inside the product, not the whole product. Everything is stored only in your browser: cases reference documents by id, nothing is ever written to a server.

**The differentiator is trust through traceability.** Document findings carry quotes the server independently verifies against the extracted text; page numbers come only from the PDF's real page markers — never guessed; case facts are badged by origin so an AI inference is never silently presented as something you said; the case-readiness number is computed by code, not the model; and the professional brief is assembled deterministically from data you already reviewed — no new AI output.

## GenAI architecture

- **Provider:** Google Gemini API via the `@google/genai` SDK — `gemini-3.5-flash-lite` by default (500 requests/day on the free tier; override with `GEMINI_MODEL`).
- **One structured call per user action.** Each response uses `response_format` with a JSON schema derived from our Zod schemas, then is **re-validated with Zod** before anything reaches the UI:
  - *Intake questions* — one call from the problem description.
  - *Case brief* — one call from problem + answers (+ compact document findings once documents are attached).
  - *Document analysis* — one call producing summary, clauses, obligations, concerns, missing information, party asymmetries, suggested scenarios, questions, and steps — no per-section calls. With a case open, the person's situation is passed along so the analysis prioritizes what matters to it.
  - *Q&A / scenario* — one focused call per question, reusing the already-extracted document text.
  - *Communication draft* — one call from the user's facts and analyzed document text.
  - The *professional brief* and *case readiness* involve **no AI call at all** — they are deterministic compositions of structured data.
- **Validation:** Gemini enforces the JSON schema; the response is then re-validated with Zod. Unparseable or schema-invalid output returns a clean error; SDK errors are mapped to safe messages. Malformed AI output can never crash the app.
- **Grounding:** every returned document quote is checked against the extracted text (`verifyQuotes`, whitespace-normalized, ellipsis-fragment-aware). The UI distinguishes verified quotes from AI paraphrases. Page numbers come only from the PDF extractor's real page markers (`findPages`). Section labels in the evidence view are AI-identified and labeled as such — never presented as independently verified.
- **Hallucination control for case briefs:** every fact carries a schema-enforced origin (`user` / `document` / `ai`). The prompt forbids inventing facts, dates, amounts, laws, rights, or deadlines, and requires "Date not specified" rather than a fabricated date. The deterministic readiness calculation and the no-AI professional brief extend the same discipline.
- **Prompt-injection defense:** all user prose and document text are wrapped in delimiters (`<problem>`, `<answers>`, `<document>`, …) and treated strictly as untrusted data in every system prompt — instructions inside them are ignored and analyzed as text. Both defenses are pinned by tests across all six prompts.
- **Document processing:** PDF via `pdf-parse` (loaded as a server-external package so its worker resolves correctly in production builds), DOCX via `mammoth`, TXT read directly. Text is normalized and capped at 120,000 characters to bound cost and latency.
- **Privacy:** `store: false` on every model call — requests and responses are not retained on Google's side. Cases and documents live only in the user's browser (localStorage, capped at 10 cases / 20 documents) and can be deleted at any time.

## Technology stack

Next.js (App Router) · TypeScript · React · Tailwind CSS v4 · `@google/genai` · Zod · `pdf-parse` · `mammoth` · Vitest

Seven runtime dependencies, no database, no vector store, no additional service, no retrieval infrastructure — the bounded context is sent directly.

## Security

- **Rate limiting:** per-IP sliding-window limit (15 requests/minute) shared across the three AI endpoints — one visitor cannot burn the API quota. In-memory by design for a single-instance deployment.
- **Secrets:** the API key lives only in `.env` (git-ignored); `.env.example` documents it. No key is ever sent to the browser.
- **File validation:** extension allow-list (PDF/DOCX/TXT/MD), 5 MB cap, empty-file rejection — all *before* parsing — plus **magic-byte checks** (a `.pdf` must start with `%PDF-`, a `.docx` with the zip signature `PK`), so a renamed arbitrary file never reaches a parser. Corrupt or password-protected files surface as clean errors.
- **Input validation:** all request payloads parsed with Zod (problem/question lengths, answer caps, document size, mode enums); text paths enforce a 200-character minimum so no AI call happens without meaningful input.
- **Prompt injection:** user prose and documents are untrusted data (see GenAI architecture); pinned by tests on every prompt.
- **Privacy:** no database, no file storage, no logging of document or case content. Documents live in request memory only; extracted text is returned to the same client that uploaded it. Local history is best-effort — if storage is blocked the app still works.
- **Safe errors:** API failures map to short user-facing messages; internals are never leaked.

## Efficiency

- **One model call per user action** — a complete case journey is ~5 calls (intake, brief, analysis, optional brief refresh per attached document, optional draft), each a single structured request.
- **Retries disabled** — the SDK's default 5-attempt retry loop is off; a failed request surfaces immediately instead of silently re-billing input tokens.
- **No AI call without meaningful input** — minimum lengths on all input paths.
- **Bounded context** — extracted text capped at 120,000 characters; case answers and document-findings summaries are capped before each call.
- **No duplicate work** — extraction happens once per document; the case stores document *ids*, not copies; the professional brief and readiness score are computed, not generated.

## Testing

`npm test` — unit tests (Vitest) covering the highest-risk logic:

- File validation: allowed types, rejected extensions, oversized and empty files
- **Magic-byte signatures**: renamed non-PDF/non-DOCX files rejected before parsing
- **DOCX extraction** (from a real minimal DOCX package built in-test) and **corrupt-PDF handling**
- Text normalization and the truncation path for oversized documents
- The grounding check: exact, whitespace-variant, ellipsis-abbreviated, blank/placeholder, absent, and empty quotes
- Evidence-map page detection: page-marker mapping, abbreviated quotes, no-markers and not-found cases
- Document analysis, request, and scenario schemas; the case schemas: source-tagged facts, timeline, intake, draft, and request validation for all three case modes
- **Case readiness**: deterministic completeness calculation
- **Rate limiter**: window behavior and per-key isolation
- Local document history and case history: round-trips, caps, deletion, corrupt/blocked storage fallback
- **The deterministic professional brief**: section composition, source labels, unverified-quote flagging
- Prompt-injection defenses: delimiters and the untrusted-data instructions in **all six** system prompts

## Accessibility

Semantic HTML with labeled regions and headings; `sr-only` labels on icon-only inputs; `role="status"`/`role="alert"` live regions for loading and errors; a labeled `progressbar` for case readiness; visible focus outlines on all interactive elements (including `<summary>`); `aria-pressed` toggles; responsive single-column layout that works at phone width; plain language throughout. A dark theme is available via the header toggle (choice remembered; defaults to system preference, applied before first paint), and all colors meet contrast requirements in both themes.

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

Any Node host. On Vercel: import the repo, set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) as environment variables, deploy. No other infrastructure is needed. (Note: on Vercel's Hobby plan, set `maxDuration` in the API routes to 60 or lower.)

```
npm run build   # production build
npm start       # production server
npm test        # test suite
```

## Demo scenarios

Three polished examples, each one click from the home page — examples of the generic system, not separate code paths (there is no domain-specific logic anywhere):

1. **Housing — "My landlord hasn't returned my security deposit."** The flagship: dynamic intake questions, a case brief with timeline and gaps, the sample rental agreement analyzed against the situation (deposit clause, wear-and-tear language, auto-renewal), verified evidence, scenarios ("What happens if the landlord refuses?"), a written refund request draft, and the consultation brief.
2. **Employment — "My employer hasn't paid my salary."** The sample employment agreement showcases obligations, notice-period and termination asymmetries between the parties, missing information (an unattached annexure), and a payment-request draft.
3. **Consumer — "A seller won't refund my defective product."** Works with **no contract at all**: a pasted purchase record and chat conversation become evidence, demonstrating that Legible is a problem navigator, not a document summarizer.

## Limitations

- The case brief and intake questions are AI-generated syntheses of what you provide. Fact origin is badged (`AI interpretation` is visibly distinct), but Legible can misread or over-connect — verify AI-tagged facts.
- Document section labels in the evidence view are AI-identified, not independently verified (the quote beside them is verified; the label is not).
- No legal-domain knowledge base, no statute lookup, no jurisdiction-specific conclusions — deliberately. Legible organizes and prepares; it does not tell you what the law says where you live.
- Documents are analyzed in-memory and returned to your browser; case and document history is browser-local (cleared if you clear site data).
- The rate limiter is per server instance; scanned PDFs (images without a text layer) cannot be read — paste the text instead.

## Legal disclaimer

Legible provides **informational assistance to help you understand, organize, and prepare**. It is not a lawyer, does not provide legal advice, and does not replace consultation with a qualified legal professional. It may miss issues or misread passages. Analyses use cautious language ("may", "consider asking a professional") by design, and the product never claims a document is legal or illegal, predicts outcomes, or states what you are legally entitled to. Always consult a licensed professional before making legal decisions.
