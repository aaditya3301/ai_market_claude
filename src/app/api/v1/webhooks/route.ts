import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { withConnectorRoute } from '@/lib/connector/route';
import { createServiceRoleClient } from '@/lib/supabase';

export async function POST(req: Request) {
  return withConnectorRoute(req, {
    scope: 'webhooks:write',
    endpoint: 'v1/webhooks.register',
    handler: async (auth) => {
      const body = await req.json().catch(() => ({}));
      const callbackUrl = String(body.callback_url || '').trim();

      if (!callbackUrl) {
        return NextResponse.json(
          envelopeError('VALIDATION_FAILED', 'callback_url is required', {
            field: 'callback_url',
          }, {
            api_version: 'v1',
            step: 'v1/webhooks.register',
          }),
          { status: 400 }
        );
      }

      const supabase = createServiceRoleClient();
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', auth.tenantId)
        .single();

      if (tenantError) throw new Error(tenantError.message);

      const settings = (tenant.settings as Record<string, unknown> | undefined) || {};
      const existingWebhooks = Array.isArray(settings.webhooks)
        ? (settings.webhooks as Array<Record<string, unknown>>)
        : [];

      const now = new Date().toISOString();
      const updatedWebhooks = [
        ...existingWebhooks.filter((item) => item.url !== callbackUrl),
        {
          id: crypto.randomUUID(),
          url: callbackUrl,
          events: Array.isArray(body.events) ? body.events : ['run.completed', 'approval.requested'],
          created_at: now,
        },
      ];

      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          settings: {
            ...settings,
            webhooks: updatedWebhooks,
          },
          updated_at: now,
        })
        .eq('id', auth.tenantId);

      if (updateError) throw new Error(updateError.message);

      return NextResponse.json(
        envelopeSuccess(
          {
            callback_url: callbackUrl,
            registered: true,
          },
          {
            api_version: 'v1',
            step: 'v1/webhooks.register',
          }
        )
      );
    },
  });
}
