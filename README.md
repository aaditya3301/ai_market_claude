# Aadi Market: The Autonomous Marketing Department

Aadi Market is an enterprise-grade, multi-agent artificial intelligence platform designed to function as a self-operating marketing department. The system orchestrates the entire marketing lifecycle, including real-time market research, strategic planning, automated content creation, social media distribution, and advertising optimization.

---

## Core Capabilities

### 1. Strategic Planning Engine (Ghost Planner)
*   **Live Data Acquisition:** Utilizes Jina Reader and Firecrawl for real-time extraction of brand and competitor data from websites and social profiles.
*   **Strategic Intelligence:** Employs Google Gemini to synthesize extracted data into comprehensive brand strategies, target audience profiles, and tactical roadmaps.

### 2. Strategic War Room Simulation
*   **Multi-Agent Dialectics:** Conducts high-fidelity simulations featuring specialized AI personas (Skeptical Auditor, Creative Director, and Data Analyst) to critique and refine marketing strategies.
*   **Institutional Memory:** Strategic directives from these simulations are persisted and used to constrain and guide all downstream content generation.

### 3. Automated Content Generation
*   **Cross-Channel Distribution:** Orchestrates the generation of platform-optimized content for LinkedIn, Twitter, Instagram, Facebook, and Reddit.
*   **Creative Asset Production:** Integrated with Fal.ai (Flux) for the generation of professional marketing imagery, with robust fallback mechanisms to Google Imagen.

### 4. Digital Advertising Infrastructure (Meta & Google)
*   **Multivariate Experimentation:** Automatically constructs ad sets based on distinct psychological triggers (Logical, Emotional, and Urgent).
*   **API Integration:** Direct connectivity with Meta Ads Manager and Google Ads for automated campaign deployment.
*   **Autonomous Optimization:** A dedicated agent analyzes real-time performance metrics and automatically deactivates underperforming variants to maximize Return on Ad Spend (ROAS).

### 5. Centralized Publishing Hub (Postiz)
*   **Enterprise Middleware:** Full integration with a self-hosted Postiz stack utilizing the Temporal workflow engine for reliable execution.
*   **Automated Scheduling:** Seamless transmission of generated assets from Aadi Market to the publishing queue for global distribution.

---

## Technical Architecture

*   **Application Framework:** Next.js 14 (App Router), Tailwind CSS
*   **Data Layer:** Supabase (PostgreSQL)
*   **Inference Engines:** Google Gemini 1.5 Flash (Text), Fal.ai Flux (Images)
*   **Infrastructure:** Docker Compose, Inngest (event runtime), Railway (Python worker)
*   **Distribution:** Postiz Social Media Middleware

---

## Deployment and Installation

### 1. System Requirements
*   Docker Desktop (Required for Postiz and Temporal services)
*   Supabase Project (PostgreSQL instance)
*   Standard API Credentials (Gemini, Fal.ai)

### 2. Workspace Configuration
Configure your environment by duplicating `.env.example` to `.env` and providing the necessary credentials:
```bash
GEMINI_API_KEY=your_key
FAL_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
POSTIZ_API_URL=http://localhost:4007/api/v1
NEXT_PUBLIC_POSTIZ_KEY=your_postiz_api_key

# Phase 1 additions
CREDENTIALS_MASTER_KEY=base64_32_byte_key
CREDENTIALS_KEY_ID=k1
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
CONNECTOR_NONCE_REDIS_URL=your_upstash_redis_url
WORKER_BASE_URL=http://localhost:8000
WORKER_SHARED_SECRET=your_worker_shared_secret
INTERNAL_BOOTSTRAP_TOKEN=admin_bootstrap_secret
```

### 3. Schema Initialization
Execute the SQL migration scripts located in `src/db/migrations/001_schema.sql` via the Supabase SQL Editor.

### 4. Local Execution
```bash
# Clone the repository
git clone https://github.com/aaditya3301/ai_market.git
cd ai_market

# Initialize the Postiz distribution stack
cd postiz
docker-compose up -d

# Execute the main application
cd ..
npm install
npm run dev
```

---

## Event Runtime (Inngest)
Phase 1 replaces Vercel cron with Inngest workflows and scheduled functions:

*   `run.requested` drives async workflow execution.
*   `approval.resolved` resumes paused runs.
*   `approvals-expiry-sweep` auto-expires stale approvals every 15 minutes.
*   `credentials-validator` runs daily credential validation fan-out.

Inngest handler route: `/api/inngest`

---

## Connector API (v1)

Phase 1 adds signed connector endpoints under `/api/v1/*`:

*   `POST /api/v1/runs`
*   `GET /api/v1/runs`
*   `GET /api/v1/runs/:id`
*   `GET /api/v1/runs/:id/outputs`
*   `POST /api/v1/runs/:id/cancel`
*   `GET /api/v1/approvals`
*   `GET /api/v1/approvals/:id`
*   `POST /api/v1/approvals/:id/resolve`
*   `POST /api/v1/webhooks`
*   `GET /api/v1/tenants/me`

Auth headers required on every `v1` request:

*   `x-ai-market-key`
*   `x-ai-market-timestamp`
*   `x-ai-market-signature`
*   `x-ai-market-nonce`

See [docs/connector-contract.md](docs/connector-contract.md) for the error catalog and response envelope.

---

## Automation Runtime Modes

Set `AUTOMATION_MODE` in environment config to control automation behavior:

*   **full**: End-to-end automation including external publishing and spend-bearing actions.
*   **guided**: Full pipeline with approval gates for spend-bearing actions.
*   **simulation**: Internal generation only, no external publishing/spend side effects.

Default mode is `simulation` when `AUTOMATION_MODE` is not set.

### Production Fail-Fast Guardrails

In production (or when `AUTOMATION_STRICT_VALIDATION=true`), startup validation enforces required configuration.

Always required:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...
```

Required for `full` and `guided` modes:

```bash
POSTIZ_API_URL=...
POSTIZ_API_KEY=...   # or NEXT_PUBLIC_POSTIZ_KEY
CRON_SECRET=...
```

If required values are missing, the app throws at startup to prevent silent automation degradation.

### Brand Identity Rule for Automation

Automation/orchestration paths must provide an explicit `brandId`.

Implicit fallback brand values are not allowed for automated server runs.

---

## Standard API Envelope (Phase 0)

Automation APIs should use this stable envelope pattern:

```json
{
	"success": true,
	"data": {},
	"error": null,
	"meta": {
		"request_id": "uuid",
		"timestamp": "ISO-8601",
		"step": "optional-step-name",
		"mode": "full|guided|simulation"
	}
}
```

Error shape:

```json
{
	"success": false,
	"data": null,
	"error": {
		"code": "ERROR_CODE",
		"message": "Human readable error",
		"details": {}
	},
	"meta": {
		"request_id": "uuid",
		"timestamp": "ISO-8601"
	}
}
```

---

## Notice
Aadi Market is an automated execution tool. All generated financial commitments (Ads) and public communications (Social Posts) should be monitored via their respective platform dashboards.

*Maintained by Aaditya Singhal (aaditya3301)*
