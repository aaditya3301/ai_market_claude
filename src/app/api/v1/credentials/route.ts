import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { withConnectorRoute } from '@/lib/connector/route';
import {
  listTenantCredentials,
  upsertTenantCredential,
  type CredentialProvider,
} from '@/lib/credentials/service';

const ALLOWED_PROVIDERS: CredentialProvider[] = [
  'meta_ads',
  'google_ads',
  'shopify',
  'klaviyo',
  'postiz',
  'fal',
  'other',
];

export async function GET(req: Request) {
  return withConnectorRoute(req, {
    scope: 'credentials:list',
    endpoint: 'v1/credentials.list',
    handler: async (auth) => {
      const credentials = await listTenantCredentials(auth.tenantId);
      return NextResponse.json(
        envelopeSuccess(
          { credentials },
          {
            api_version: 'v1',
            step: 'v1/credentials.list',
          }
        )
      );
    },
  });
}

export async function POST(req: Request) {
  return withConnectorRoute(req, {
    scope: 'credentials:write',
    endpoint: 'v1/credentials.upsert',
    handler: async (auth) => {
      const body = await req.json().catch(() => ({}));
      const provider = String(body.provider || '').trim() as CredentialProvider;
      const accountId = String(body.account_id || '').trim();

      if (!ALLOWED_PROVIDERS.includes(provider)) {
        return NextResponse.json(
          envelopeError('VALIDATION_FAILED', 'provider is invalid', {
            field: 'provider',
          }, {
            api_version: 'v1',
            step: 'v1/credentials.upsert',
          }),
          { status: 400 }
        );
      }

      if (!accountId) {
        return NextResponse.json(
          envelopeError('VALIDATION_FAILED', 'account_id is required', {
            field: 'account_id',
          }, {
            api_version: 'v1',
            step: 'v1/credentials.upsert',
          }),
          { status: 400 }
        );
      }

      const secret = body.secret;
      if (!secret || typeof secret !== 'object' || Array.isArray(secret)) {
        return NextResponse.json(
          envelopeError('VALIDATION_FAILED', 'secret must be an object', {
            field: 'secret',
          }, {
            api_version: 'v1',
            step: 'v1/credentials.upsert',
          }),
          { status: 400 }
        );
      }

      const row = await upsertTenantCredential({
        tenantId: auth.tenantId,
        provider,
        accountId,
        displayName: typeof body.display_name === 'string' ? body.display_name : undefined,
        secret,
        metadata:
          body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
            ? body.metadata
            : undefined,
      });

      return NextResponse.json(
        envelopeSuccess(
          {
            id: row.id,
            provider: row.provider,
            account_id: row.account_id,
            status: row.status,
          },
          {
            api_version: 'v1',
            step: 'v1/credentials.upsert',
          }
        )
      );
    },
  });
}
