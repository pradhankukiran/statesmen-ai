# Statesmen AI — Project Plan

> An app to chat with AI parodies of British political figures, generated on demand from real Hansard speeches.

## 1. Vision

Users browse or search the UK Parliament's Members API for any politician (PM, MP, or Lord) past or present, click "Chat with X", and within seconds (cache hit) or ~60 seconds (cold build) they're chatting with an AI version of that person whose voice is grounded in their actual recorded speeches.

No upload. No accounts. No fine-tuning. No vector DBs. Just **off-the-shelf LLMs + a well-engineered prompt pipeline + a cached `.md` per persona**.

Architecture is designed so the same pipeline can later target the US Presidency Project and EU Parliament archives without rewrites.

## 2. Core architecture

### High-level flow

```
┌───────────────────────────────────────────────────────────────┐
│                          USER FLOW                            │
│                                                               │
│  Homepage (popular grid + search)                             │
│      │                                                        │
│      ▼                                                        │
│  Profile page  ── Members API ──▶ photo, dates, party, bio    │
│      │                                                        │
│      ▼ "Chat with X"                                          │
│      │                                                        │
│      ├─ cache HIT  ──▶ open chat instantly                    │
│      │                                                        │
│      └─ cache MISS ──▶ build pipeline (streamed progress)     │
│                          │                                    │
│                          ▼                                    │
│                       open chat                               │
└───────────────────────────────────────────────────────────────┘
```

### Build pipeline (cold path)

```
Hansard search by date+attribution
      │
      ▼
Filter to person's actual contributions
      │
      ▼
Clean + concatenate text
      │
      ▼
Token-aware chunker  (~10k tokens per chunk)
      │
      ▼
Per-chunk LLM extraction (OpenRouter/Claude)
   → JSON: vocab, patterns, devices, tone, examples
      │
      ▼
Reduce: merge N chunk-extractions into ONE persona
   → Single coherent style profile
      │
      ▼
Render persona.md (system prompt) + examples.json (few-shot)
      │
      ▼
Save to Vercel Blob, key = persona slug
```

### Runtime chat

```
User msg ──▶ /api/chat ──▶ load persona.md + examples.json
                              │
                              ▼
                  System prompt = persona + examples
                              │
                              ▼
                  Groq Llama 3.3 70B (streaming)
                              │
                              ▼
                  SSE response back to useChat()
```

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | First-class Vercel deploy, modern routing |
| Language | TypeScript (strict) | Real types for API responses |
| UI | shadcn/ui + Tailwind CSS | Fast, clean, fully customizable |
| Streaming chat | Vercel AI SDK (`ai` + `@ai-sdk/groq`) | Built-in streaming, `useChat` hook |
| LLM (chat) | Groq · `llama-3.3-70b-versatile` | Fast streaming for realtime UX |
| LLM (extraction) | OpenRouter · `anthropic/claude-3.5-sonnet` (or GPT-4o) | Higher quality offline-style extraction |
| Validation | Zod | Schema-validate every LLM JSON output |
| Tokenization | `js-tiktoken` | Token-accurate chunking |
| HTTP/HTML | `cheerio` (only if needed) | Hansard returns JSON, may not need scraping |
| Storage | Vercel Blob | Cached persona .md + .examples.json |
| Hosting | Vercel Hobby | Free, native Next.js |
| Data sources | UK Parliament Members API, Hansard API | Free, no auth required |

### Data sources confirmed (already tested via curl)

- **Members API**: `https://members-api.parliament.uk/api/Members/Search?Name=...&IsCurrentMember=false`
  - Returns paginated members with photo URLs, bios, terms.
- **Hansard search**: `https://hansard-api.parliament.uk/search/contributions/Spoken.json?queryParameters.searchTerm=...&queryParameters.startDate=...&queryParameters.endDate=...&queryParameters.take=...`
  - Returns spoken contributions (1803–present).
  - Modern records carry `MemberId`. Historical records have `MemberId == -1` and identify speakers via the `AttributedTo` string (e.g., "The Prime Minister", "Mr. Blair").
- **Filter strategy**: for modern PMs, filter by `MemberId`. For historical PMs (Thatcher, etc.), filter by `AttributedTo == "The Prime Minister"` constrained to their tenure dates.

## 4. Project structure

```
statesmen-ai/
├── app/                              # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                      # Homepage: popular grid + search
│   ├── p/[slug]/page.tsx             # Profile page
│   ├── chat/[slug]/page.tsx          # Chat page
│   └── api/
│       ├── persons/
│       │   ├── search/route.ts       # GET ?q=<name>
│       │   └── [id]/route.ts         # GET single member profile
│       └── persona/
│           ├── build/route.ts        # POST (SSE stream)
│           └── status/route.ts       # GET (cache lookup)
│       └── chat/route.ts             # POST (Vercel AI SDK)
├── components/
│   ├── ui/                           # shadcn primitives
│   ├── PersonCard.tsx
│   ├── PersonGrid.tsx
│   ├── SearchBar.tsx
│   ├── BuildProgress.tsx             # SSE consumer
│   ├── ChatWindow.tsx
│   └── SuggestedStarters.tsx
├── lib/
│   ├── members.ts                    # Members API client
│   ├── hansard.ts                    # Hansard API client
│   ├── chunker.ts                    # Token-aware splitter
│   ├── extractor.ts                  # Per-chunk LLM extraction
│   ├── merger.ts                     # Reduce N chunks → 1 persona
│   ├── persona.ts                    # Pipeline orchestrator
│   ├── cache.ts                      # Vercel Blob wrapper (+ disk fallback)
│   ├── slug.ts                       # Slugify member name
│   └── prompts/
│       ├── extract.ts
│       ├── merge.ts
│       └── chat.ts                   # System prompt template
├── scripts/                          # Standalone CLI (not deployed)
│   ├── test-fetch.ts
│   ├── test-extract.ts
│   └── test-build.ts
├── data/
│   ├── popular-pms.json              # Hardcoded homepage seed list
│   └── personas/                     # Local-dev cache (gitignored)
├── public/
│   └── (static assets)
├── PLAN.md                           # ← this file
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── components.json                   # shadcn config
├── .gitignore
└── .env.example
```

## 5. Phases (a phase = a logical, committable slice)

Each phase ends with a working state and at least one commit. No phase is merged with the next until verified.

### Phase 0 — Project skeleton  ◀ in progress
- Create directory, git init, `.gitignore`
- Write `PLAN.md` (this file)
- **Deliverable:** committed empty repo with planning artifacts.

### Phase 1 — Next.js foundation
- `npx create-next-app` (TypeScript, Tailwind, App Router, ESLint)
- Initialize shadcn/ui (`npx shadcn@latest init`)
- Add base shadcn components used everywhere: button, input, card, dialog, scroll-area, skeleton, badge
- Strip default Vercel chrome from homepage
- Add a basic `<RootLayout>` with header + footer
- **Deliverable:** `npm run dev` shows a styled placeholder homepage.

### Phase 2 — Data layer (Hansard + Members)
- `lib/members.ts`:
  - `searchMembers(query, opts)` → paginated typed list
  - `getMember(id)` → single profile incl. terms & photo URL
- `lib/hansard.ts`:
  - `searchContributions({ memberId?, attributedTo?, startDate, endDate, searchTerm?, take, skip })`
  - Helpers for pagination
- Zod schemas for both APIs' response shapes
- `scripts/test-fetch.ts` — CLI: pull verified speeches for Thatcher 1979–1990 and Tony Blair 1997–2007, print stats (count, total tokens, sample quotes).
- **Deliverable:** confidence that we can extract a clean corpus for any PM via CLI.

### Phase 3 — Chunker + extractor
- `lib/chunker.ts`: split a long string into ~10k-token chunks, prefer paragraph boundaries
- `lib/prompts/extract.ts`: the extraction prompt (style notes + verbatim examples)
- `lib/extractor.ts`: hits OpenRouter with a chunk, returns Zod-validated JSON
- `scripts/test-extract.ts`: pipe sample text → chunker → one extraction → print result
- **Deliverable:** can produce structured style data from raw speeches via CLI.

### Phase 4 — Persona generator (build pipeline)
- `lib/prompts/merge.ts`: prompt that reduces N chunk-extractions to one persona
- `lib/merger.ts`: runs merge call
- `lib/persona.ts`: orchestrates fetch → chunk → extract → merge → render MD
- `scripts/test-build.ts`: end-to-end build for "margaret-thatcher", writes `data/personas/margaret-thatcher.md` and `.examples.json`
- **Deliverable:** local file outputs that read like the person.

### Phase 5 — Cache layer
- `lib/cache.ts`:
  - `getPersona(slug)` → returns MD + examples or null
  - `setPersona(slug, md, examples)`
  - Vercel Blob in production; `data/personas/` filesystem in dev
- **Deliverable:** persistence works in both environments.

### Phase 6 — API routes
- `/api/persons/search?q=`: thin proxy + transform to UI-friendly shape
- `/api/persons/[id]`: profile fetch
- `/api/persona/status?slug=`: cache lookup, returns ready/building/missing
- `/api/persona/build` (SSE): runs pipeline, streams progress events
- `/api/chat` (POST): Vercel AI SDK `streamText` with persona system prompt
- **Deliverable:** all endpoints respond correctly via curl.

### Phase 7 — Homepage
- `app/page.tsx`:
  - Hero
  - Popular-PMs grid (data from `data/popular-pms.json`)
  - Search bar that calls `/api/persons/search`
  - Result cards
- `components/PersonGrid.tsx`, `PersonCard.tsx`, `SearchBar.tsx`
- **Deliverable:** browsable homepage with working search.

### Phase 8 — Profile page
- `app/p/[slug]/page.tsx`
- Shows photo, name, party, terms, bio
- "Chat with X" CTA → triggers `/api/persona/status` first, routes accordingly
- **Deliverable:** click any person, see profile, click chat to enter pipeline.

### Phase 9 — Build progress UX
- `components/BuildProgress.tsx`: hooks into SSE `/api/persona/build`
- Shows live progress lines: "Fetching 247 speeches", "Analyzing chunk 4 of 9", etc.
- On completion event, redirects to `/chat/[slug]`
- **Deliverable:** the cold-path wait feels intentional, not broken.

### Phase 10 — Chat page
- `app/chat/[slug]/page.tsx`: shadcn chat shell using `useChat()` from `ai/react`
- Header with persona photo + name + parody disclaimer
- 3 suggested starters per persona (template-generated)
- Markdown rendering of assistant messages
- **Deliverable:** working end-to-end conversation.

### Phase 11 — Polish
- Mobile responsiveness
- Loading skeletons everywhere
- Error states (thin data, API failures, rate limits)
- Era-locking nudge in chat system prompt ("if asked about events after your time, acknowledge unfamiliarity")
- Footer disclaimer + GitHub link
- 404 / not-found pages
- **Deliverable:** ship-ready quality.

### Phase 12 — Deploy
- Vercel project linked
- Env vars set: `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `BLOB_READ_WRITE_TOKEN`
- Optional: custom domain
- **Deliverable:** live production URL.

## 6. Key design decisions

| Topic | Decision |
|---|---|
| Pre-built personas | None. Pre-seed = popular **names** for the homepage only, not pre-generated MDs. |
| Cache scope | Server-side, shared. One persona file benefits all users. |
| LLM split | OpenRouter (Claude) for extraction; Groq (Llama 70B) for chat. |
| Cache backend | Vercel Blob in prod; `data/personas/` filesystem in dev. |
| Thin-data threshold | If <30 verified contributions, refuse to build with a friendly message. |
| Concurrency | Out of scope. (No lock; double-build is acceptable cost.) |
| Rate limiting | Out of scope. |
| Analytics | Out of scope. |
| User accounts | Out of scope. |
| Compare mode | Out of scope. |

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cold-path build exceeds Vercel function timeout | Stream as SSE so connection stays alive; parallelize chunk extraction |
| Hansard API rate limits | Throttle with `p-limit`, add retry-with-backoff |
| LLM returns malformed JSON | Zod validate, retry once with stricter prompt, fail with friendly error |
| Hallucinated "verbatim" quotes | Extraction prompt enforces verbatim only; later: validate quotes exist in source corpus |
| Costs spiral | OpenRouter spend cap; log every build with token counts |
| Legal — impersonation | Footer + chat-header disclaimer ("AI parody, not actual statements"); never auto-publish |
| Many MPs have thin corpora | Refuse to build below the threshold; surface that in the UI |

## 8. Out of scope

- User accounts and chat history persistence
- Compare-mode (multi-persona side-by-side answers)
- Share-quote-as-image
- US presidents, EU officials (future expansion)
- Voice input/output
- Custom user-uploaded transcripts
- Mobile native apps
- Concurrency locks, rate limits, analytics

## 9. Conventions

- **Commits:** small, conventional-commits style (`feat:`, `chore:`, `fix:`, `docs:`, `refactor:`).
- **Branch:** `main`. No feature branches; phase commits land directly.
- **Code style:** Next.js + TS defaults, Prettier auto-format.
- **Naming:** persona slugs are kebab-case full names (`margaret-thatcher`, `tony-blair`).
- **Env:** all secrets via `.env.local` (gitignored); `.env.example` checked in for reference.
