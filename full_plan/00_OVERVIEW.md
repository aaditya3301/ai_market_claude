# ai_market Rebuild — Master Overview

**Status:** Planning doc. Read this first, then work through `01_PHASE_1_FOUNDATION.md` → `05_PHASE_5_OPERATOR_UI.md` in order.

**Owner:** Aaditya Singhal (aaditya3301)
**Repo:** https://github.com/aaditya3301/ai_market

---

## 1. What ai_market Is (After The Rebuild)

A multi-tenant marketing-ops service that plugs into a parent marketplace platform as a callable skill. Businesses onboard on the parent platform, bring their own credentials (Meta Ads, Google Ads, Shopify, social accounts), and the parent platform's browser agent calls ai_market to execute marketing work on their behalf.

ai_market itself:
- Runs research, planning, creative generation, ad orchestration, SEO, video, publishing
- Auto-executes safe/cheap work (research, drafts, analytics, simulations)
- Surfaces approval requests for spend-bearing or publicly-visible work (ads, publishes, SEO go-live, email/SMS)
- Exposes a clean operator UI for humans (Linear/Vercel dark-pro aesthetic, non-technical marketer persona)

It is **not** a fully-autonomous bot. It's a marketing ops platform with strong automation on the safe parts and mandatory human-in-the-loop on the risky parts.

---

## 2. Two Consumers, One System

Every capability ai_market exposes must be callable two ways:

### 2.1 Parent platform's browser agent (primary)
- Calls signed connector API (`/v1/...`)
- Polls or subscribes via webhooks
- Can approve/reject approval requests on behalf of user if scope allows
- Escalates to human in parent platform when required

### 2.2 Human marketer (operator UI)
- Logs in to ai_market dashboard directly (or SSO from parent)
- Reviews approval queue, monitors runs, inspects creative library, reads performance dashboards
- Can manually trigger runs, override automation, pause tenants, kill-switch campaigns

**Design principle:** API is the source of truth. UI is a view on the API. Never build a UI action that isn't exposed as an API endpoint.

---

## 3. Business Goals (Why We're Doing This)

1. **Run BeatBand on ai_market in production** — replace current patchwork marketing stack.
2. **Productize as SaaS** — agencies and D2C brands pay to use it directly or via the parent marketplace.
3. **Be a credible entry in the parent platform's skill catalog** — good enough that the parent platform routes marketing-shaped work to it over alternatives.

These goals dictate:
- Multi-tenancy is non-negotiable (can't ship SaaS without it)
- Credential isolation is non-negotiable (BYO creds across tenants)
- Observability is non-negotiable (can't operate SaaS blind)
- Approval gates are non-negotiable (can't give random businesses an autonomous spend bot)

---

## 4. HITL (Human-In-The-Loop) Policy

This is the single most important policy in the system. Memorize it.

| Action Category | Mode | Notes |
|---|---|---|
| Web scraping, research, trend detection | **Auto** | No external side effects |
| Planning drafts, strategy generation | **Auto** | Lands in review queue, not published |
| War-room simulations | **Auto** | Internal artifact only |
| Creative drafts (copy/image/video) | **Auto** | Lands in creative library as `draft` |
| Analytics aggregation, reports | **Auto** | Read-only |
| Internal simulations (ad forecasts, etc.) | **Auto** | No real spend |
| **Ad launch** | **Approval required** | Blocks on `approval_requests` |
| **Ad budget change** (any increase, or decrease > 20%) | **Approval required** | |
| **Social publish** (LinkedIn, Twitter/X, IG) | **Approval required** | |
| **SEO article go-live** | **Approval required** | |
| **Email/SMS send** | **Approval required** | |
| **Shopify write ops** (product, price, inventory) | **Approval required** | |
| **Credential add/remove** | **Approval required** | Also tenant-admin only |

Approvals are a first-class resource:
- Stored in `approval_requests` table with payload, state, TTL
- Exposed via `/v1/approvals` API (list, approve, reject)
- Rendered in operator UI as a dedicated queue surface
- Parent platform's agent can auto-approve if its scope permits; otherwise it routes the request to the end-user inside the parent platform

---

## 5. Channel Scope

**In scope:** LinkedIn, Twitter/X, Instagram, Meta Ads, Google Ads, SEO (including Google Search Console), short-form video, email, SMS (added for owned-channel completeness), Shopify integration.

**Dropped:** Facebook organic, Reddit (landmine for branded content as noted — we still *monitor* Reddit for signals but don't post to it).

---

## 6. Tech Stack (Locked)

### 6.1 Core web/API
- **Next.js 16** App Router, TypeScript strict mode
- **Tailwind + shadcn/ui** for UI components
- **Framer Motion** for animations (keep, already present)
- **Zod** for runtime validation everywhere (API input, env, DB DTOs)

### 6.2 Data layer
- **Supabase Postgres** with **pgvector** enabled
- **Row-Level Security** mandatory on every tenant-scoped table
- **Supabase Auth** for operator UI login + magic link
- **Supabase Storage** for small artifacts; **Cloudflare R2** for all media at scale

### 6.3 Workflows & events
- **Inngest** for all async work — replaces Vercel cron entirely
  - Durable step functions, automatic retries, built-in dashboard, event fan-out
  - Why Inngest over BullMQ: serverless-native, no Redis ops, no dedicated worker infra for the web side
  - Why Inngest over Trigger.dev: simpler onboarding, cheaper at our scale, adequate for our patterns
- Cron-style jobs live inside Inngest as scheduled functions, not as Vercel cron routes

### 6.4 ML & heavy compute
- **Python FastAPI worker** deployed on **Railway**
- Handles: Bayesian A/B inference, creative scoring, embedding batch jobs, time-series forecasting, fatigue detection models
- Exposes internal API; called from Next.js via signed service-to-service token
- Dependencies: pymc, scipy, numpy, pandas, sentence-transformers, torch (CPU), fastapi, uvicorn, gunicorn

### 6.5 Agents & RAG
- **LangGraph** for multi-step agent state machines (war room, research, creative tree planning)
- **LlamaIndex** for retrieval and reranking over pgvector
- Collections: `brand_voice` (synced from parent), `past_content`, `competitor_content`, `review_corpus`, `trend_corpus`, `performance_embeddings`

### 6.6 LLMs (multi-model routing)
A single `LLMRouter` module picks the right model per task:
- **Gemini 1.5 Flash / 2.0 Flash** — volume work: post generation, SEO drafts, caption variations, cheap summarization
- **Claude Sonnet 4.6 (or latest)** — strategic tasks: war-room reasoning, creative tree architecture, brand-voice sensitive generation, long-context review synthesis
- **GPT-5** — fallback + specialized structured-output tasks where the tools/function-calling API is stronger

Router is aware of: task type, required context length, cost tier, per-tenant budget cap.

### 6.7 Media generation
- **Fal.ai (Flux)** — existing, keep for fast image gen
- **Google Imagen** — fallback (existing)
- **Runway Gen-3 or Google Veo** — short-form video gen (choose based on cost/quality at phase 4)
- **ElevenLabs** — voiceover (optional, phase 4)

### 6.8 Data integrations
- **Shopify Admin API** (read product catalog, orders, customers — write is approval-gated)
- **Google Search Console API** (real SEO data, ranking + impressions feedback loop)
- **DataForSEO** or **Serper.dev** for SERP scraping (pick DataForSEO — more robust, SERP features richer)
- **Apify** (existing, keep) for general scraping + Twitter/Reddit
- **Klaviyo / Resend** — email platform (Klaviyo for D2C, Resend for transactional; support both)
- **Twilio** — SMS
- **Trustpilot scraping + Amazon review scraping** (via Apify actors) for VOC/review corpus
- **Google Trends + pytrends** on the Python worker for trend signals

### 6.9 Ops & observability
- **Sentry** for error tracking (web + python worker)
- **PostHog** for product analytics on the operator UI
- **Better Stack (Logtail)** or Axiom for log aggregation
- **Inngest Dashboard** for workflow/run observability (built-in)
- **Stripe** for SaaS billing + plan enforcement
- **Upstash Redis** for rate limiting and short-lived caches (cheap, serverless)

### 6.10 Hosting
- **Vercel** — Next.js app + API routes
- **Supabase Cloud** — DB + auth + storage
- **Railway** — Python worker
- **Cloudflare R2** — media CDN
- **Inngest Cloud** — workflows
- Everything else is SaaS (Stripe, Sentry, PostHog, Fal, Klaviyo, Twilio)

---

## 7. The Five Phases At A Glance

### Phase 1 — Foundation
Multi-tenant data model, BYO credential vault (encrypted), connector API with HMAC auth, Inngest event runtime, approval/HITL framework, Python worker bootstrap, observability baseline, tenant admin primitives.

**Unlocks:** Everything else. Nothing after this works without Phase 1 done right.

### Phase 2 — Intelligence Core
Brand-voice sync from parent platform, vector store setup, grounded war room (personas fed with real evidence), performance feedback loop, competitor intel daily pipeline, trend detection pipeline, LLM router, LangGraph agent framework.

**Unlocks:** All content/ads/SEO generation gets smarter and brand-consistent from here on.

### Phase 3 — Ads 2.0
Full creative tree data model (concepts × hooks × formats × offers × audiences), Bayesian A/B with minimum-sample gates, creative fatigue detection, winner-spawn loop, audience ladder (cold→warm→hot), budget pacing + guardrails, Meta Ads + Google Ads API rebuild with idempotent deployment, simulation harness.

**Unlocks:** The single biggest value-prop vs competitors. This is where the system earns its keep on ad spend.

### Phase 4 — Channels & Lifecycle
Platform-native organic generation (LinkedIn long-form/carousel, Twitter threads, IG Reels/carousel), content-mix orchestrator, SEO rebuild (SERP analysis + intent + gap + cluster + GSC feedback), video pipeline (script→storyboard→b-roll→render), Shopify catalog integration, review/UGC ingestion & repurposing, email/SMS channels, scheduling optimizer.

**Unlocks:** Real multichannel coverage. BeatBand can actually run on this.

### Phase 5 — Operator UI & SaaS Hardening
Full Linear/Vercel-vibe UI rebuild: approval queue, creative library, run monitor, performance dashboards (real attribution: GA4 + platform + Shopify + GSC), cohort/LTV/CAC/MER/ROAS views, experimentation viewer, tenant admin, Stripe billing, plan limits, usage metering, white-label option, production runbook, alerting, connector SDK for parent platform.

**Unlocks:** SaaS-ready. Ship to first external customers.

---

## 8. Cross-Phase Principles (Apply Everywhere)

1. **Tenant isolation or die.** Every query filters by `tenant_id`. Every RLS policy enforces it. No shared state across tenants.
2. **Idempotency everywhere.** Every write op takes an `idempotency_key`. Replays are safe.
3. **Approvals are data, not control flow.** The approval request is a row. The approver action is an API call. No in-memory `await` on human input — use Inngest's `step.waitForEvent`.
4. **Simulated mode is explicit and flagged.** If a provider is missing or disabled, we don't fake success — we mark the output `is_simulated: true` with provenance. Real vs simulated is visible in every analytics view.
5. **Provenance on every artifact.** Every generated asset records: model used, prompt hash, inputs, RAG citations, human edits, approval history.
6. **LLM calls are router-mediated.** No direct `gemini.generate(...)` in feature code. Always `llmRouter.call({ task, ...})`. Enables cost control, per-tenant budget caps, model swaps.
7. **Python worker is service-to-service authed.** Signed requests. No public exposure.
8. **Write migrations, not ad-hoc SQL.** Every schema change is a numbered migration in `src/db/migrations/` with matching `down` SQL committed for rollback.
9. **Feature flags per tenant.** New capabilities roll out tenant-by-tenant, not globally.

---

## 9. Migration Philosophy (How To Not Break What Works)

Current `ai_market` has working pieces (planning, war room, campaign, artifacts, Postiz integration). We are **refactoring**, not rewriting from scratch.

Per phase each README has a **"Migration from current state"** section with three categories:

- **Kept as-is** — code that survives untouched
- **Transformed** — code that gets refactored/wrapped/moved but keeps its logic
- **Deprecated** — code that gets deleted (with the replacement named)

Critically: **the legacy click-driven dashboard stays working until Phase 5**. Orchestration API and operator UI get built in parallel. We don't cut the old UI until the new one is better. No "big bang" deploys.

---

## 10. File Tree (Target State After All 5 Phases)

```
ai_market/
├── apps/
│   ├── web/                          # Next.js app (existing repo)
│   │   ├── src/
│   │   │   ├── app/                  # App Router pages + API
│   │   │   │   ├── (operator)/       # Operator UI (Phase 5)
│   │   │   │   └── api/
│   │   │   │       ├── v1/           # Public connector API (versioned)
│   │   │   │       ├── internal/     # Service-to-service (worker calls, webhooks)
│   │   │   │       └── inngest/      # Inngest function handler
│   │   │   ├── lib/
│   │   │   │   ├── agents/           # LangGraph agents (Phase 2+)
│   │   │   │   ├── ads/              # Ads engine (Phase 3)
│   │   │   │   ├── channels/         # Per-channel adapters (Phase 4)
│   │   │   │   ├── connector/        # HMAC auth, contract validators
│   │   │   │   ├── credentials/      # BYO creds vault + decryption
│   │   │   │   ├── events/           # Inngest function definitions
│   │   │   │   ├── intelligence/     # RAG, competitor, trends (Phase 2)
│   │   │   │   ├── llm/              # LLM router + provider adapters
│   │   │   │   ├── runtime/          # Config, envelope, feature flags
│   │   │   │   ├── tenancy/          # Tenant context, RLS helpers
│   │   │   │   └── workers/          # Python worker client
│   │   │   ├── components/
│   │   │   └── db/
│   │   │       └── migrations/
│   │   └── package.json
│   └── worker/                       # NEW: Python FastAPI worker
│       ├── app/
│       │   ├── bayesian/             # Bayesian A/B
│       │   ├── embeddings/           # Batch embedding jobs
│       │   ├── forecasting/          # Time-series
│       │   ├── scoring/              # Creative/content scoring
│       │   └── main.py
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   └── connector-sdk/                # NEW: TypeScript SDK for parent platform
├── docs/
│   ├── 00_OVERVIEW.md                # This file
│   ├── 01_PHASE_1_FOUNDATION.md
│   ├── 02_PHASE_2_INTELLIGENCE.md
│   ├── 03_PHASE_3_ADS.md
│   ├── 04_PHASE_4_CHANNELS.md
│   ├── 05_PHASE_5_OPERATOR_UI.md
│   ├── connector-contract.md         # Frozen API contract
│   ├── runbook.md                    # Ops runbook
│   └── adr/                          # Architecture Decision Records
├── postiz/                           # Existing self-hosted publisher (kept, may be deprecated in P4)
└── package.json                      # Monorepo root (pnpm workspaces)
```

Note the monorepo move in the target state. Phase 1 introduces pnpm workspaces; before that, the repo is single-package.

---

## 11. Sequencing & Dependencies

```
Phase 1 (Foundation) ────────────────────────► required by everything
   │
   ├──► Phase 2 (Intelligence) ──────────────► required by 3, 4
   │        │
   │        ├──► Phase 3 (Ads 2.0) ──────────► can ship independently of 4
   │        │
   │        └──► Phase 4 (Channels) ─────────► can ship independently of 3
   │
   └──► Phase 5 (Operator UI) ───────────────► needs 1–4 substantially done
                                                UI components for each prior
                                                phase ship alongside that phase;
                                                Phase 5 is the consolidation
                                                + SaaS hardening layer
```

Phase 3 and Phase 4 can be parallelized if you have the capacity. If you're solo, do them in order (3 first — highest ROI).

---

## 12. Definition Of Done (Per Phase)

Every phase README ends with acceptance criteria. In addition, the whole rebuild is "done" when:

1. BeatBand is running live on ai_market as its tenant, replacing the current stack
2. At least one external tenant (agency or D2C brand) is onboarded via parent platform
3. Parent platform's browser agent can execute a full marketing loop (research → plan → creatives → approval → publish → measure) using only the `/v1/*` connector API
4. Ads module has driven a real A/B test to statistical significance on a real budget
5. Runbook exists, alerts fire, on-call can recover a failed run in under 15 minutes
6. A new tenant can onboard in under 10 minutes with zero engineering involvement

---

## 13. What To Read Next

Open `01_PHASE_1_FOUNDATION.md`. Do not skim. Phase 1 has the most cross-cutting decisions — multi-tenancy, auth, events, approvals — and mistakes here are expensive to fix later.
