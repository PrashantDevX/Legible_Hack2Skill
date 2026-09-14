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
Consultation-ready brief
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

- **Provider:** Anthropic — Claude API (`claude-opus-5` by default, override with `CLAUDE_MODEL`)
- **Structured output:** each analysis is **one** API call via `client.messages.parse()` with a Zod schema (`output_config.format`). One call produces summary, clauses, obligations, concerns, questions, and steps — no per-section calls.
- **Validation:** the schema constrains the model *and* validates the response. `parsed_output` is null-checked; SDK errors are mapped to safe messages (rate limit, auth, 5xx, connection). Malformed AI output can never crash the app.
- **Grounding:** beyond schema validation, every returned quote is checked against the extracted text (`verifyQuotes`, whitespace-normalized substring match). The UI distinguishes verified quotes from AI paraphrases.
- **Document processing:** PDF via `pdf-parse`, DOCX via `mammoth`, TXT read directly. Text is normalized (line endings, blank lines) and capped at 120,000 characters (~30K tokens) to bound cost per request.
- **Efficiency (Q&A):** the document sits in a `cache_control: ephemeral` system block, so follow-up questions read it from the prompt cache instead of re-billing full input.
- **Prompt-injection defense:** document text is wrapped in `<document>` tags and the system prompt instructs the model to treat it strictly as untrusted data — instructions inside a document ("ignore previous instructions…") are ignored and analyzed as text. Both defenses are pinned by tests.

## Technology stack

Next.js (App Router) · TypeScript · React · Tailwind CSS v4 · `@anthropic-ai/sdk` · Zod · `pdf-parse` · `mammoth` · Vitest

Every dependency earns its place; there is no database, no vector store, and no additional service. Extracted-document analysis at this size does not need retrieval infrastructure.

## Security

- **Secrets:** the API key lives only in `.env` (git-ignored); `.env.example` documents it. No key is ever sent to the browser.
- **File validation:** extension allow-list (PDF/DOCX/TXT/MD), 5 MB cap, empty-file rejection — all *before* parsing.
- **Input validation:** all request payloads parsed with Zod (question length, history cap, document size); text paths enforce a 200-character minimum so no AI call is made without meaningful input.
- **Prompt injection:** documents are untrusted data (see GenAI architecture).
- **Privacy:** no database, no file storage, no logging of document content. Documents live in request memory only; the extracted text is returned to the same client that uploaded it so follow-up questions can be grounded.
- **Safe errors:** API failures map to short user-facing messages; internals are never leaked.

## Testing

`npm test` — 17 unit tests (Vitest) covering the highest-risk logic:

- File validation: allowed types, rejected extensions, oversized and empty files
- Text normalization and the truncation path for oversized documents
- The grounding check: exact, whitespace-variant, absent, and empty quotes
- Request schema: valid, empty, too-short, oversized, and over-history requests
- Prompt-injection defenses: `<document>` delimiters and the untrusted-data instructions in both system prompts

## Accessibility

Semantic HTML with labeled regions and headings; `sr-only` labels on icon-only inputs; `role="status"`/`role="alert"` live regions for loading and errors; visible focus outlines on all interactive elements; ARIA tabs for input mode; responsive single-column layout that works at phone width; plain language throughout.

## Setup

```bash
npm install
cp .env.example .env   # then set ANTHROPIC_API_KEY
npm run dev            # http://localhost:3000
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Anthropic API key, server-side only |
| `CLAUDE_MODEL` | no | Model override (default `claude-opus-5`) |

## Deployment

Any Node host. On Vercel: import the repo, set `ANTHROPIC_API_KEY` (and optionally `CLAUDE_MODEL`) as environment variables, deploy. No other infrastructure is needed.

```
npm run build   # production build
npm start       # production server
npm test        # test suite
```

## Legal disclaimer

Legible provides **informational assistance to help you read and understand documents**. It is not a lawyer, does not provide legal advice, and does not replace consultation with a qualified legal professional. It may miss issues or misread passages. Analyses use cautious language ("may", "consider asking a professional") by design, and the product never claims a document is legal or illegal or predicts outcomes. Always consult a licensed professional before making legal decisions.
