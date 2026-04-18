import { createServiceRoleClient } from '@/lib/supabase';

export function scopedClient(tenantId: string) {
  if (!tenantId) {
    throw new Error('TENANT_REQUIRED: tenantId is required for scoped database access.');
  }

  const client = createServiceRoleClient();

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => {
          const query = target.from(table);
          return (query as unknown as { eq: (column: string, value: string) => unknown }).eq(
            'tenant_id',
            tenantId
          );
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
