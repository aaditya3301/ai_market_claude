# Aadi Market

Practical quickstart for local setup, run, and smoke testing.

## Stack

- Web app: Next.js 16 + TypeScript
- Database: Supabase Postgres
- Event runtime: Inngest
- Worker: Python FastAPI
- Publishing middleware: Postiz (Docker)

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+
- Docker Desktop
- A Supabase project

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

Copy env template:

```bash
cp .env.example .env
```

Then fill required values in .env:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- GEMINI_API_KEY
- CREDENTIALS_MASTER_KEY
- INNGEST_EVENT_KEY
- INNGEST_SIGNING_KEY
- INTERNAL_BOOTSTRAP_TOKEN
- WORKER_SHARED_SECRET

Notes:

- Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (these names are required by the code).
- Keep AUTOMATION_MODE=simulation for first-time setup.

## 3. Run database migrations

Run these SQL files in your Supabase SQL editor in this order:

1. src/db/migrations/001_schema.sql
2. src/db/migrations/002_automation_runs.sql
3. src/db/migrations/003_multitenancy.sql

## 4. Start Postiz (Docker)

```bash
cd postiz
docker-compose up -d
cd ..
```

## 5. Start Python worker

```bash
cd apps/worker
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Worker health endpoint:

```bash
curl http://localhost:8000/health
```

## 6. Start web app

In a new terminal from project root:

```bash
npm run dev
```

App URL:

- http://localhost:3000

## 7. Optional: run Inngest dev server

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

## 8. Standard smoke checks

### A) Build check

```bash
npm run build
```

Expected: build completes without errors.

### B) Internal worker bridge check

```bash
curl -X POST http://localhost:3000/api/internal/worker/echo \
	-H "content-type: application/json" \
	-d '{"ping":"ok"}'
```

Expected: success true and echoed payload.

### C) Tenant bootstrap check

```bash
curl -X POST http://localhost:3000/api/internal/admin/tenants \
	-H "x-bootstrap-token: YOUR_INTERNAL_BOOTSTRAP_TOKEN" \
	-H "content-type: application/json" \
	-d '{
		"parent_tenant_id": "local-tenant-1",
		"parent_platform_id": "local",
		"name": "Local Tenant",
		"slug": "local-tenant"
	}'
```

Expected: success true and tenant object returned.

### D) API key issuance check

```bash
curl -X POST http://localhost:3000/api/internal/admin/api-keys \
	-H "x-bootstrap-token: YOUR_INTERNAL_BOOTSTRAP_TOKEN" \
	-H "content-type: application/json" \
	-d '{
		"tenant_id": "PASTE_TENANT_ID_HERE",
		"name": "local-key",
		"scopes": ["runs:create", "runs:list", "runs:read", "runs:outputs", "runs:cancel", "approvals:list", "approvals:read", "approvals:resolve", "webhooks:write", "tenants:read", "credentials:list", "credentials:write"]
	}'
```

Expected: success true and api_key + secret returned.

## 9. Common issues

- Missing env error at runtime:
	- Verify .env has all required keys and restart dev server.
- Supabase table errors:
	- Re-check migration order 001 -> 002 -> 003.
- Worker bridge fails:
	- Ensure WORKER_SHARED_SECRET is the same in web .env and worker .env.
- Postiz not reachable:
	- Ensure docker-compose in postiz is up and port 4007 is open.

## Project status

- Phase 1 foundations are implemented: multitenancy, connector API, approvals, Inngest runtime, worker scaffold.

