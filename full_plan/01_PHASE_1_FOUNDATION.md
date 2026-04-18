# Phase 1 — Foundation

**Multi-tenant core, BYO credentials vault, connector API, event-driven runtime, HITL approvals, Python worker bootstrap.**

**Duration estimate:** 2–3 weeks focused work
**Prerequisite:** Read `00_OVERVIEW.md` first
**Outcome:** A hardened multi-tenant base that every later phase builds on. Nothing after Phase 1 works correctly without this phase done right.

---

## 1. Why Phase 1 Exists (The Problems We're Fixing)

Today `ai_market` has four foundational weaknesses that must be fixed before any intelligent work matters:

1. **Single-tenant in its guts.** Tables don't have `tenant_id`. The notion of "brand" exists but there's no ownership model, no auth boundary, and no credential isolation. Anyone who knows a `brand_id` can act on that brand. This is incompatible with both SaaS and the parent-platform-marketplace model.

2. **No credential isolation.** Keys for Meta Ads, Google Ads, Postiz, Fal, etc. live in a single `.env`. Every tenant would share the same credentials. For BYO-creds this is a showstopper.

3. **Cron-driven execution.** Vercel cron at 08:00 / 09:00 / 22:00 UTC is fine for a demo — useless for 50 tenants across timezones with different approval rhythms, budgets, and channel mixes. No retries, no durable state, no fan-out, no observability.

4. **No approval primitive.** The system is either fully-auto or fully-manual click. There's no first-class concept of "this action needs a human decision, block until resolved."

Phase 1 fixes all four and introduces the connector API surface the parent platform's browser agent will call.

---

## 2. What Ships At End Of Phase 1

A developer or parent-platform agent can:

1. Create a tenant, issue it a scoped API key
2. Add Meta/Google/Shopify/Klaviyo credentials for that tenant (encrypted at rest)
3. Call `POST /v1/runs` with a goal payload → receive `run_id`
4. The run executes as an Inngest workflow with durable steps
5. At any point, the run can raise an `approval_request` and pause
6. The parent platform can list pending approvals via `/v1/approvals`, approve or reject
7. The run resumes on approval, completes, and outputs are retrievable via `/v1/runs/:id/outputs`
8. Everything is logged, traced, tenant-scoped, and observable in Inngest + Sentry

Legacy click-driven dashboard still works. No UI is deleted in Phase 1. The operator UI stays exactly as it is; we add to it in Phase 5.

---

## 3. Monorepo Migration (Do This First)

Current repo is single-package. Phase 1 moves to **pnpm workspaces** so the Python worker and future connector-sdk live in the same repo without polluting the Next.js deployment.

### 3.1 Target structure

```
ai_market/
├── apps/
│   ├── web/          # the existing Next.js app, moved here
│   └── worker/       # NEW: Python FastAPI worker
├── packages/
│   └── connector-sdk/  # stubbed in Phase 1, fleshed out in Phase 5
├── docs/             # all the READMEs you're reading
├── postiz/           # existing Postiz stack (untouched)
├── pnpm-workspace.yaml
├── package.json      # monorepo root
└── turbo.json        # optional: Turborepo for parallel builds
```

### 3.2 Migration steps

1. Create `apps/web/` and move everything currently in `src/`, `public/`, `next.config.ts`, `tsconfig.json`, `package.json`, `tailwind.config.ts` into `apps/web/`.
2. Create root `package.json` with `"private": true, "packageManager": "pnpm@9.x"`.
3. Create `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```
4. Update `vercel.json` to point at `apps/web` (`"buildCommand": "cd apps/web && pnpm build"` or configure via Vercel project settings).
5. Verify `pnpm install && pnpm --filter web dev` works and the legacy app runs unchanged.
6. Commit. No feature changes in this commit — it's purely structural.

Everything below assumes we're inside `apps/web/` unless otherwise stated.

---

## 4. The Multi-Tenant Data Model

### 4.1 New core tables

Migration: `src/db/migrations/003_multitenancy.sql`

```sql
-- Organizations = billable entity. A tenant of the parent platform.
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_tenant_id TEXT NOT NULL,              -- ID from the parent platform
  parent_platform_id TEXT NOT NULL,            -- which parent platform (future-proof)
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',       -- active | suspended | archived
  plan_code TEXT NOT NULL DEFAULT 'trial',     -- trial | starter | growth | scale
  timezone TEXT NOT NULL DEFAULT 'UTC',
  settings JSONB NOT NULL DEFAULT '{}',        -- kill switches, feature flags
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_platform_id, parent_tenant_id)
);

-- Users who can access the operator UI directly
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,                  -- Supabase auth.users.id
  role TEXT NOT NULL,                           -- owner | admin | operator | reviewer | viewer
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, auth_user_id)
);

-- API keys for the connector (parent platform uses these)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,                    -- first 8 chars, shown in UI
  key_hash TEXT NOT NULL,                      -- bcrypt/argon2 hash of full key
  secret_hash TEXT NOT NULL,                   -- hash of HMAC signing secret
  scopes TEXT[] NOT NULL DEFAULT '{}',         -- 'runs:create','approvals:resolve',...
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES tenant_users(id)
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
```

### 4.2 Retrofit `tenant_id` onto existing tables

Every existing table gets a `tenant_id UUID NOT NULL REFERENCES tenants(id)` column. This is the biggest migration of Phase 1. The pattern:

```sql
-- Example: brands table retrofit
ALTER TABLE brands ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Backfill: create a default tenant and assign all existing rows
INSERT INTO tenants (id, parent_tenant_id, parent_platform_id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'legacy', 'internal', 'Legacy BeatBand Tenant', 'legacy-beatband');

UPDATE brands SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

ALTER TABLE brands ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX idx_brands_tenant ON brands(tenant_id);
```

Tables to retrofit (all of them): `brands`, `brand_plans`, `campaigns`, `artifacts`, `profile_setups`, `competitor_posts`, `seo_clusters`, `seo_articles`, `video_assets`, `automation_runs`, `automation_run_steps`.

Write a migration script that does all of these in one file with backfill in the correct dependency order. Do it transactionally.

### 4.3 Row-Level Security

Every tenant-scoped table gets RLS policies. The pattern:

```sql
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Policy: user can see brands for their tenants
CREATE POLICY tenant_isolation_select ON brands
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users
    WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY tenant_isolation_modify ON brands
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users
    WHERE auth_user_id = auth.uid()
    AND role IN ('owner','admin','operator')
  ));
```

Server-side code that runs under the service role (cron jobs, Inngest functions, connector API after auth) bypasses RLS but **must explicitly scope every query by `tenant_id`**. Enforce this with a helper:

```ts
// src/lib/tenancy/scoped-supabase.ts
export function scopedClient(tenantId: string) {
  const client = createServiceRoleClient();
  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => target.from(table).eq('tenant_id', tenantId);
      }
      return target[prop as keyof typeof target];
    }
  });
}
```

All feature code uses `scopedClient(ctx.tenantId)` instead of the raw client. Add an ESLint rule (or simple grep in CI) to forbid direct `supabase.from(...)` in feature code outside `src/lib/tenancy/`.

---

## 5. Credentials Vault (BYO Creds)

Each tenant connects their own accounts. Credentials are encrypted at rest using envelope encryption.

### 5.1 Schema

```sql
CREATE TABLE tenant_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,              -- 'meta_ads' | 'google_ads' | 'shopify' | 'klaviyo' | ...
  account_id TEXT NOT NULL,            -- external account identifier (ad_account, store, etc.)
  display_name TEXT,                   -- for UI
  ciphertext BYTEA NOT NULL,           -- AES-GCM encrypted JSON blob
  encryption_key_id TEXT NOT NULL,     -- which KMS/master key
  nonce BYTEA NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}', -- public metadata (scopes, expiry, not secrets)
  status TEXT NOT NULL DEFAULT 'active', -- active | expired | revoked | needs_reauth
  last_used_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, account_id)
);
```

### 5.2 Encryption approach

Envelope encryption with a master key stored in an env secret manager (Vercel encrypted env or dedicated KMS):

```ts
// src/lib/credentials/vault.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const MASTER_KEY = Buffer.from(process.env.CREDENTIALS_MASTER_KEY!, 'base64'); // 32 bytes
const KEY_ID = process.env.CREDENTIALS_KEY_ID!; // for rotation

export function encryptCredential(plaintext: object) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', MASTER_KEY, nonce);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([data, tag]),
    nonce,
    encryption_key_id: KEY_ID
  };
}

export function decryptCredential(row: { ciphertext: Buffer; nonce: Buffer }) {
  const tag = row.ciphertext.slice(-16);
  const data = row.ciphertext.slice(0, -16);
  const decipher = createDecipheriv('aes-256-gcm', MASTER_KEY, row.nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}
```

**Rules:**
- `decryptCredential` is only callable from server code. It never runs in a route handler directly — it runs inside a provider adapter (`metaAdsClient`, `shopifyClient`, etc.) that takes `tenantId` and handles lifecycle.
- Every decryption is logged with `tenant_id`, `provider`, `caller` (Inngest function name or API route).
- Rotation: `encryption_key_id` lets us re-encrypt old rows to a new master key.

### 5.3 Credential lifecycle

States: `active → needs_reauth → expired → revoked`.

A daily Inngest function (`credentials.validate.daily`) pings each active credential:
- Meta Ads: `me/adaccounts` call
- Google Ads: `customers:listAccessibleCustomers`
- Shopify: `shop.json`
- Klaviyo: `accounts` endpoint

If a call fails with 401/403 → move to `needs_reauth`, create an approval request for tenant admin, freeze any automated work that depends on that provider.

---

## 6. The Connector API (`/v1/...`)

This is the contract the parent platform's browser agent calls. Frozen shape from Phase 1 onward — we only add endpoints, never break existing ones. Version bump required for breaking changes (`/v2/...`).

### 6.1 Authentication

Two-part: API key + HMAC signature.

```
Request headers:
  x-ai-market-key:        aim_live_<prefix>_<random>
  x-ai-market-timestamp:  1713456789
  x-ai-market-signature:  hex(HMAC-SHA256(secret, timestamp + "." + method + "." + path + "." + sha256(body)))
  x-ai-market-nonce:      <uuid>                   (replay protection)
```

Server validates:
1. Key exists, not revoked, not expired
2. Timestamp within ±300s of server time
3. Nonce not seen in last 10 minutes (Redis set with TTL)
4. Signature matches
5. Scope includes the endpoint being called

Implementation: `src/lib/connector/auth.ts`. Middleware on every `/v1/*` route.

### 6.2 Endpoints (Phase 1 set)

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/runs` | Start a new run |
| GET | `/v1/runs` | List runs for tenant |
| GET | `/v1/runs/:id` | Get run status + step timeline |
| GET | `/v1/runs/:id/outputs` | Get final outputs when complete |
| POST | `/v1/runs/:id/cancel` | Cancel in-flight run |
| GET | `/v1/approvals` | List pending approvals |
| GET | `/v1/approvals/:id` | Get full approval context |
| POST | `/v1/approvals/:id/resolve` | Approve or reject (with optional edits) |
| POST | `/v1/webhooks` | Register a webhook URL for events |
| GET | `/v1/tenants/me` | Current tenant info (for debugging) |

### 6.3 Standard envelope

Already defined in the codebase (`src/lib/api-envelope.ts`). Keep the shape. All `/v1/*` endpoints must return it.

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-04-18T09:00:00Z",
    "api_version": "v1"
  }
}
```

### 6.4 POST /v1/runs (the main entry point)

```json
// Request
{
  "idempotency_key": "beatband_2026-04-18_planning_cycle",
  "goal": "weekly_planning_cycle",        // goal codes defined in src/lib/runs/goals.ts
  "inputs": {
    "brand_id": "uuid",
    "channels": ["linkedin", "twitter", "instagram"],
    "week_of": "2026-04-20"
  },
  "mode": "guided",                        // 'full' | 'guided' | 'simulation'
  "callback_url": "https://parent.com/webhooks/ai-market"  // optional
}

// Response 202 Accepted
{
  "success": true,
  "data": {
    "run_id": "run_01h...",
    "status": "queued",
    "goal": "weekly_planning_cycle",
    "mode": "guided",
    "created_at": "2026-04-18T09:00:00Z"
  },
  "meta": { ... }
}
```

Important:
- Idempotent: same `idempotency_key` for the same tenant returns the same `run_id` (never duplicates work).
- Returns 202 immediately; execution is async via Inngest.
- `goal` is a named workflow, not freeform. Phase 1 goals: `weekly_planning_cycle`, `research_only`, `single_artifact_generation`. Later phases add more.

### 6.5 Error catalog

Stable error codes (string enum). Document in `docs/connector-contract.md`.

```
AUTH_INVALID_KEY
AUTH_INVALID_SIGNATURE
AUTH_EXPIRED_TIMESTAMP
AUTH_INSUFFICIENT_SCOPE
AUTH_NONCE_REPLAY

VALIDATION_FAILED          (with details.field array)
IDEMPOTENCY_CONFLICT
RUN_NOT_FOUND
APPROVAL_NOT_FOUND
APPROVAL_ALREADY_RESOLVED

TENANT_SUSPENDED
CREDENTIAL_MISSING         (details.provider)
CREDENTIAL_NEEDS_REAUTH
PLAN_LIMIT_EXCEEDED

UPSTREAM_PROVIDER_ERROR    (details.provider, details.upstream_code)
RATE_LIMITED               (details.retry_after)
INTERNAL_ERROR
```

---

## 7. Event-Driven Runtime: Inngest

Inngest replaces Vercel cron entirely. Every async operation is an Inngest function.

### 7.1 Setup

```bash
pnpm --filter web add inngest
```

Create the Inngest handler:

```ts
// apps/web/src/app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/events/client';
import { functions } from '@/lib/events/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions
});
```

```ts
// apps/web/src/lib/events/client.ts
import { Inngest, EventSchemas } from 'inngest';
import type { Events } from './schema';

export const inngest = new Inngest({
  id: 'ai_market',
  schemas: new EventSchemas().fromRecord<Events>()
});
```

```ts
// apps/web/src/lib/events/schema.ts
// STRICTLY TYPED event schema. Extended in every phase.
export type Events = {
  'run.requested': {
    data: {
      tenant_id: string;
      run_id: string;
      goal: string;
      mode: 'full' | 'guided' | 'simulation';
      inputs: Record<string, unknown>;
    };
  };
  'run.step.completed': {
    data: { tenant_id: string; run_id: string; step: string };
  };
  'run.cancelled': {
    data: { tenant_id: string; run_id: string };
  };
  'approval.requested': {
    data: { tenant_id: string; run_id: string; approval_id: string };
  };
  'approval.resolved': {
    data: { tenant_id: string; approval_id: string; decision: 'approved' | 'rejected' };
  };
  'credentials.validate.scheduled': { data: {} };
  // ... extended per phase
};
```

### 7.2 Workflow: the weekly planning cycle goal

This is the reference workflow. Phase 2+ adds more, but they all follow this pattern.

```ts
// apps/web/src/lib/events/functions/weekly-planning-cycle.ts
import { inngest } from '../client';
import { runPlanningStep, runWarRoomStep, runCampaignStep } from '@/lib/runs/steps';

export const weeklyPlanningCycle = inngest.createFunction(
  {
    id: 'weekly-planning-cycle',
    concurrency: [
      { scope: 'env', limit: 50 },                    // global
      { scope: 'fn', key: 'event.data.tenant_id', limit: 2 }  // per-tenant
    ],
    retries: 3
  },
  { event: 'run.requested' },
  async ({ event, step, logger }) => {
    const { run_id, tenant_id, mode } = event.data;

    // Step 1: research + planning
    const plan = await step.run('planning', () =>
      runPlanningStep({ run_id, tenant_id })
    );

    // Step 2: war room refinement
    const warRoom = await step.run('war-room', () =>
      runWarRoomStep({ run_id, tenant_id, plan })
    );

    // Step 3: campaign generation (drafts only, no publish)
    const campaigns = await step.run('campaigns', () =>
      runCampaignStep({ run_id, tenant_id, warRoom })
    );

    // Step 4: if mode !== simulation, request publish approval
    if (mode !== 'simulation') {
      const approvalId = await step.run('create-approval', () =>
        createPublishApproval({ run_id, tenant_id, campaigns })
      );

      const resolution = await step.waitForEvent('wait-approval', {
        event: 'approval.resolved',
        match: 'data.approval_id',
        if: `async.data.approval_id == "${approvalId}"`,
        timeout: '72h'
      });

      if (!resolution || resolution.data.decision !== 'approved') {
        await step.run('mark-rejected', () =>
          markRunRejected({ run_id, reason: resolution ? 'rejected' : 'approval_timeout' })
        );
        return { status: 'rejected' };
      }

      await step.run('publish', () =>
        publishApprovedCampaigns({ run_id, tenant_id })
      );
    }

    await step.run('finalize', () => finalizeRun({ run_id, tenant_id }));
    return { status: 'complete' };
  }
);
```

Key primitives:
- `step.run(...)` — durable step, result cached, retried on failure
- `step.waitForEvent(...)` — pauses up to 72h waiting for approval
- `concurrency` — per-tenant limit prevents one noisy tenant exhausting capacity
- `retries: 3` — automatic retry with exponential backoff

### 7.3 Scheduled jobs (former cron)

Delete everything in `src/app/api/cron/`. Replace with Inngest scheduled functions:

```ts
// apps/web/src/lib/events/functions/scheduled/credentials-validator.ts
export const credentialsValidator = inngest.createFunction(
  { id: 'credentials-validator' },
  { cron: '0 3 * * *' },  // 03:00 UTC daily
  async ({ step }) => {
    const tenants = await step.run('list-tenants', () => listActiveTenants());
    for (const tenantId of tenants) {
      await step.sendEvent('fan-out', {
        name: 'credentials.validate.tenant',
        data: { tenant_id: tenantId }
      });
    }
  }
);
```

This fan-out pattern is used everywhere later: one scheduled trigger → N per-tenant events → each processed with concurrency control.

### 7.4 What happens to Vercel cron

Remove all entries from `vercel.json`. The file becomes trivial (or deletable). Inngest dashboard becomes the source of truth for scheduled work.

---

## 8. The Approvals / HITL Framework

### 8.1 Schema

```sql
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id UUID REFERENCES automation_runs(id),
  kind TEXT NOT NULL,                  -- 'publish_artifacts' | 'launch_ads' | 'send_email' | ...
  title TEXT NOT NULL,                 -- human-readable summary
  summary TEXT,                        -- longer description
  payload JSONB NOT NULL,              -- what would be done (artifacts, ad specs, etc.)
  context JSONB,                       -- relevant metrics, brand info, risk factors
  policy_snapshot JSONB,               -- the policies that applied at request time
  state TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | expired | cancelled
  requested_by TEXT NOT NULL,          -- 'system' | 'user:uuid' | 'agent:key_id'
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  resolution_edits JSONB,              -- approver can edit the payload before approving
  expires_at TIMESTAMPTZ NOT NULL,     -- default: requested_at + 72h
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approvals_tenant_pending
  ON approval_requests(tenant_id, state)
  WHERE state = 'pending';
```

### 8.2 Approval resolver

```ts
// apps/web/src/lib/approvals/service.ts
export async function createApproval(input: CreateApprovalInput): Promise<string> {
  const row = await db.insert('approval_requests', {
    ...input,
    expires_at: new Date(Date.now() + 72 * 3600_000)
  });
  await inngest.send({
    name: 'approval.requested',
    data: { tenant_id: input.tenant_id, run_id: input.run_id, approval_id: row.id }
  });
  return row.id;
}

export async function resolveApproval(
  approvalId: string,
  decision: 'approved' | 'rejected',
  actor: Actor,
  edits?: object,
  note?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await tx.selectOneForUpdate('approval_requests', approvalId);
    if (row.state !== 'pending') {
      throw new DomainError('APPROVAL_ALREADY_RESOLVED');
    }
    await tx.update('approval_requests', approvalId, {
      state: decision,
      resolved_at: new Date(),
      resolved_by: actor.toString(),
      resolution_edits: edits ?? null,
      resolution_note: note ?? null
    });
  });
  await inngest.send({
    name: 'approval.resolved',
    data: { approval_id: approvalId, decision, ... }
  });
}
```

### 8.3 Expiry job

An Inngest scheduled function runs every 15 minutes, marks expired approvals, emits `approval.resolved` with `decision: 'rejected'` and note `'auto-expired'`. This ensures paused runs don't hang forever.

### 8.4 Policy evaluation

A policy module decides whether an action needs approval at all. Used at the start of every action handler:

```ts
// apps/web/src/lib/approvals/policy.ts
export type ActionContext = {
  tenant_id: string;
  action: string;
  mode: 'full' | 'guided' | 'simulation';
  budget_impact_usd?: number;
  is_public?: boolean;
};

export function requiresApproval(ctx: ActionContext): boolean {
  // simulation: never requires approval (no real side effects)
  if (ctx.mode === 'simulation') return false;

  // full mode: only spend/public-bearing actions need approval
  if (ctx.mode === 'full') {
    return ctx.budget_impact_usd != null || ctx.is_public === true;
  }

  // guided mode: default all side-effecting actions need approval
  return Boolean(ctx.budget_impact_usd != null || ctx.is_public);
}
```

Phase 3 extends this with per-tenant policy rules (e.g., budget threshold below which auto-approve is allowed).

---

## 9. Python Worker Bootstrap

Phase 1 stands up the worker with a trivial healthcheck endpoint so we know the deploy/auth path works. Real ML work lands in Phase 2 and Phase 3.

### 9.1 Scaffold

```
apps/worker/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── auth.py
│   ├── config.py
│   └── routes/
│       ├── __init__.py
│       └── health.py
├── requirements.txt
├── Dockerfile
├── railway.toml
└── README.md
```

### 9.2 Auth (service-to-service)

The Next.js app calls the worker with a shared secret + HMAC signature (same pattern as connector auth, different secret):

```python
# apps/worker/app/auth.py
import hmac, hashlib, time
from fastapi import Header, HTTPException, Request
from app.config import WORKER_SHARED_SECRET

async def verify_internal_call(
    request: Request,
    x_timestamp: str = Header(...),
    x_signature: str = Header(...)
):
    if abs(time.time() - int(x_timestamp)) > 300:
        raise HTTPException(401, "expired timestamp")
    body = await request.body()
    expected = hmac.new(
        WORKER_SHARED_SECRET.encode(),
        f"{x_timestamp}.{request.method}.{request.url.path}.{hashlib.sha256(body).hexdigest()}".encode(),
        hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, x_signature):
        raise HTTPException(401, "bad signature")
```

### 9.3 Dockerfile + Railway

```dockerfile
# apps/worker/Dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
CMD ["gunicorn", "app.main:app", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

```toml
# apps/worker/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "gunicorn app.main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT"
healthcheckPath = "/health"
```

### 9.4 Next.js client for the worker

```ts
// apps/web/src/lib/workers/client.ts
export class WorkerClient {
  async call<T>(path: string, body: object, opts: { timeoutMs?: number } = {}): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = JSON.stringify(body);
    const bodyHash = createHash('sha256').update(bodyStr).digest('hex');
    const signature = createHmac('sha256', process.env.WORKER_SHARED_SECRET!)
      .update(`${timestamp}.POST.${path}.${bodyHash}`)
      .digest('hex');

    const res = await fetch(`${process.env.WORKER_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-timestamp': timestamp,
        'x-signature': signature
      },
      body: bodyStr,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000)
    });
    if (!res.ok) throw new WorkerError(await res.text(), res.status);
    return res.json();
  }
}
```

---

## 10. Observability Baseline

### 10.1 Request IDs everywhere

Every incoming connector request gets a `request_id`. It flows through:
- Log lines (`request_id=req_abc123`)
- Response envelope `meta.request_id`
- Inngest event data
- Worker calls (propagated in headers)
- DB inserts on run/step rows

Implementation: AsyncLocalStorage-based context (`src/lib/runtime/context.ts`) loaded by route middleware.

### 10.2 Structured logging

Drop `console.log`. Use **pino** with pretty output in dev, JSON in prod:

```ts
// apps/web/src/lib/runtime/logger.ts
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'ai_market_web' },
  formatters: {
    level: (label) => ({ level: label })
  }
});
```

Ship logs to Axiom or Better Stack via their Pino transport.

### 10.3 Sentry

```bash
pnpm --filter web add @sentry/nextjs
```

Configure for both server and client. Sample rate 10% for traces in prod, 100% for errors. Tag every event with `tenant_id` from context.

Python worker: `pip install sentry-sdk[fastapi]`, same pattern.

### 10.4 Metrics we care about

From day one, emit these counters/timers:
- `connector.request.count{endpoint,status}`
- `connector.request.latency_ms{endpoint}`
- `run.started{goal,mode}`
- `run.completed{goal,mode,status}`
- `run.step.latency_ms{step}`
- `approval.created{kind}`
- `approval.resolved{kind,decision,latency_hours}`
- `llm.call{provider,model,task,status}`
- `llm.tokens{provider,model,type}` (input/output)
- `worker.call{op,status}`

Use a simple in-process counter + periodic flush to Axiom or Better Stack. Don't install Prometheus in Phase 1 — overkill.

---

## 11. Feature Flags

Per-tenant feature flags live in `tenants.settings.feature_flags`. Read through a central helper:

```ts
// apps/web/src/lib/runtime/features.ts
export async function isFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
  const t = await getTenant(tenantId);
  const flags = t.settings?.feature_flags ?? {};
  if (flags[feature] === true) return true;
  if (flags[feature] === false) return false;
  return DEFAULT_FLAGS[feature] ?? false;
}
```

Use this for every new capability. Never launch a new channel/goal to all tenants at once — enable via flag, monitor, roll out.

---

## 12. Migration From Current State

### 12.1 Kept as-is (no changes)

- `src/lib/planning-service.ts` (business logic unchanged, only caller changes)
- `src/lib/campaign-service.ts` (same)
- `src/lib/war-room-service.ts` (same, heavily rewritten in Phase 2)
- `src/lib/gemini.ts` (wrapped by LLM router in Phase 2 but lives)
- `src/lib/fal-service.ts`
- `src/lib/scraper-service.ts`
- `src/lib/apify-service.ts`
- Existing dashboard pages under `src/app/dashboard/*`
- Postiz stack under `postiz/` (eval replacement in Phase 4; leave alone for now)

### 12.2 Transformed

- `src/lib/supabase.ts` → split into service-role client (for background jobs) and user-scoped RLS client (for UI actions). Add `scopedClient(tenantId)` helper.
- `src/lib/runtime-config.ts` → stays but extended with connector-auth config, worker URLs, Inngest keys.
- `src/lib/api-envelope.ts` → stays, add `request_id` propagation from context.
- `src/lib/run-store.ts` → extended with `tenant_id` column on all queries, retry metadata.
- `src/lib/orchestrator.ts` → **retired as the execution engine.** Its step-dispatch logic moves into Inngest functions. Its state helpers stay as pure DB readers for the UI and API.
- Existing `src/app/api/orchestration/*` endpoints → keep working URLs for backward compat, but internally they just forward to `/v1/runs`.
- `src/app/api/feature/*` endpoints (planning/create, campaigns/launch) → gated behind feature flag; legacy UI keeps calling them; new paths go through `/v1/runs`.

### 12.3 Deprecated (remove in Phase 1)

- `src/app/api/cron/daily-posts/route.ts` → replaced by Inngest scheduled function
- `src/app/api/cron/publish-social/route.ts` → replaced by publish workflow triggered on approval
- `src/app/api/cron/optimize-ads/route.ts` → replaced by `ads.optimize.daily` Inngest fn (Phase 3 rebuilds it anyway)
- `runAutopublisherAction` in `src/app/actions/db.ts` → delete. Legacy hack.
- All `vercel.json` cron entries

---

## 13. Environment Variables (Phase 1 additions)

```bash
# Already present
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=

# NEW in Phase 1
CREDENTIALS_MASTER_KEY=                  # base64, 32 bytes
CREDENTIALS_KEY_ID=k1

INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

WORKER_BASE_URL=https://ai-market-worker.up.railway.app
WORKER_SHARED_SECRET=                    # 32+ random chars

CONNECTOR_NONCE_REDIS_URL=               # Upstash Redis for nonce cache
CONNECTOR_TIMESTAMP_SKEW_SECONDS=300

SENTRY_DSN_WEB=
SENTRY_DSN_WORKER=
AXIOM_TOKEN=
AXIOM_DATASET=

LOG_LEVEL=info
```

Python worker adds its own:

```bash
# apps/worker/.env
WORKER_SHARED_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=
SENTRY_DSN=
```

---

## 14. Acceptance Criteria

Phase 1 is done when all of these pass:

1. **Monorepo works.** `pnpm install`, `pnpm --filter web dev`, `pnpm --filter worker dev` all succeed from root.
2. **Multi-tenancy enforced.** A brand created under tenant A is invisible to tenant B through every API endpoint and UI query. Verified with an integration test that creates two tenants and attempts cross-tenant reads/writes.
3. **Credentials encrypted.** Inspecting `tenant_credentials.ciphertext` in DB shows binary data, not plaintext JSON. Decryption works only with correct master key.
4. **Connector API signed.** A call to `/v1/runs` without a valid HMAC signature returns 401 with `AUTH_INVALID_SIGNATURE`. A replayed request (same nonce) within 10 minutes returns 401 with `AUTH_NONCE_REPLAY`.
5. **Inngest runs the weekly cycle.** Sending `POST /v1/runs` with `goal: "weekly_planning_cycle"` produces visible steps in the Inngest dashboard: planning → war-room → campaigns → wait-approval.
6. **Approvals work.** When a run hits an approval step, `GET /v1/approvals` shows it pending. Resolving via `POST /v1/approvals/:id/resolve` unblocks the run within 10 seconds.
7. **Approval expiry works.** A pending approval past its `expires_at` moves to `expired` state automatically and emits the rejection event.
8. **Python worker healthchecked.** `GET /health` on the worker returns 200. A signed call from the Next.js app succeeds; an unsigned call returns 401.
9. **All legacy cron removed.** `vercel.json` has no cron entries. `src/app/api/cron/` is empty/deleted. The equivalent Inngest functions are visible in the Inngest dashboard.
10. **Observability baseline.** Every `/v1/*` request produces a log line with `request_id` and `tenant_id`. Sentry captures a thrown error from any path.
11. **Legacy dashboard still works.** Existing UI flows (manual planning create, campaign launch, etc.) execute successfully under the "legacy tenant" created during migration.
12. **Idempotency honored.** Two `POST /v1/runs` calls with the same `idempotency_key` return the same `run_id`; the second never duplicates work.

---

## 15. Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Multi-tenancy retrofit breaks existing flows | Migration creates a legacy tenant; all existing rows are backfilled to it before `NOT NULL` constraint. Feature-flag the v1 API; legacy paths unaffected. |
| Credential key leak | Master key lives only in Vercel encrypted env. Separate key per environment. Rotation supported from day one via `encryption_key_id`. |
| Inngest cold starts on Vercel | Accept it for Phase 1. Inngest retries are automatic. If latency becomes a real complaint, move handler to a persistent host (same Railway worker). |
| Python worker deploy complexity | Railway is minimal-config. If Railway is unreliable, fallback is Fly.io or a long-running Vercel Functions region. |
| Approval queue grows unbounded | 72h expiry is mandatory. UI surfaces "stale approvals" count. Auto-cancel runs whose approvals keep expiring > 3 times. |
| HMAC signing complexity for parent platform | Ship a `connector-sdk` package that handles signing. Phase 1 stubs it; Phase 5 polishes. |

---

## 16. What You Can Ignore Until Later Phases

These are explicitly out of scope for Phase 1. Don't get distracted:

- Real performance attribution (Phase 5)
- Brand voice RAG (Phase 2)
- Creative tree, Bayesian ads (Phase 3)
- SEO rebuild, video pipeline (Phase 4)
- Operator UI polish, dashboards, approval queue surface (Phase 5)
- Stripe billing, plan limits (Phase 5)
- Connector SDK public release (Phase 5)

Resist the urge to partially build any of these in Phase 1. A clean foundation > a half-built second floor.

---

## 17. Rough Sequencing Inside Phase 1

If solo, approximately:

- **Week 1:** Monorepo migration, multi-tenancy schema + backfill, RLS, tenant/API key CRUD, scoped Supabase helper
- **Week 2:** Credentials vault, connector auth middleware, `/v1/runs` + `/v1/runs/:id` endpoints, Inngest setup, first workflow (weekly_planning_cycle) end-to-end
- **Week 3:** Approvals schema + API + wait-for-event wiring, Python worker scaffold, observability (logger, Sentry, request IDs), feature flags, delete all legacy cron, write acceptance tests, document

Don't skip the acceptance tests. They're what make Phase 2 safe.

---

## 18. Proceed To Phase 2

Once acceptance criteria pass and the legacy dashboard still boots, open `02_PHASE_2_INTELLIGENCE.md`. Phase 2 is where the system actually starts being smart.
