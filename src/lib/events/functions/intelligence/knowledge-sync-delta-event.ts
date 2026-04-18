import { inngest } from '@/lib/events/client';
import { syncKnowledgePackForTenant } from '@/lib/intelligence/knowledge';

export const knowledgeSyncDeltaEvent = inngest.createFunction(
  {
    id: 'knowledge-sync-delta-event',
    triggers: { event: 'brand.knowledge.sync.delta' },
    retries: 2,
  },
  async ({ event, step }) => {
    const tenantId = String(event.data.tenant_id || '').trim();
    if (!tenantId) throw new Error('tenant_id is required');

    const result = await step.run('sync-knowledge-pack', () =>
      syncKnowledgePackForTenant({ tenantId })
    );

    return {
      tenantId,
      synced: result.synced,
    };
  }
);
