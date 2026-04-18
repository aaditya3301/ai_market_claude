import { inngest } from '@/lib/events/client';
import { listActiveTenants } from '@/lib/intelligence/tenants';
import { syncKnowledgePackForTenant } from '@/lib/intelligence/knowledge';

export const knowledgeSyncDelta = inngest.createFunction(
  {
    id: 'knowledge-sync-delta',
    triggers: { cron: '0 */6 * * *' },
  },
  async ({ step }) => {
    const tenants = await step.run('list-tenants', () => listActiveTenants(200));

    let synced = 0;

    for (const tenant of tenants) {
      const result = await step.run(`sync-${tenant.id}`, () =>
        syncKnowledgePackForTenant({ tenantId: tenant.id })
      );
      synced += result.synced;
    }

    return {
      tenants: tenants.length,
      synced,
    };
  }
);
