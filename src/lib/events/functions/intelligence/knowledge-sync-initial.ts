import { inngest } from '@/lib/events/client';
import { syncKnowledgePackForTenant, embedPendingKnowledgeChunks } from '@/lib/intelligence/knowledge';

export const knowledgeSyncInitial = inngest.createFunction(
  {
    id: 'knowledge-sync-initial',
    triggers: { event: 'brand.knowledge.sync.initial' },
    retries: 2,
  },
  async ({ event, step }) => {
    const tenantId = String(event.data.tenant_id || '').trim();
    const brandId = event.data.brand_id ? String(event.data.brand_id) : undefined;

    if (!tenantId) {
      throw new Error('tenant_id is required');
    }

    const synced = await step.run('sync-knowledge-pack', async () =>
      syncKnowledgePackForTenant({ tenantId, brandId })
    );

    const embedded = await step.run('embed-pending-chunks', async () =>
      embedPendingKnowledgeChunks({ tenantId, limit: 128 })
    );

    return {
      tenantId,
      synced: synced.synced,
      embedded: embedded.embedded,
    };
  }
);
