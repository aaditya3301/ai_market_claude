import { inngest } from '@/lib/events/client';
import { listActiveTenants } from '@/lib/intelligence/tenants';
import { embedPendingKnowledgeChunks } from '@/lib/intelligence/knowledge';

export const knowledgeEmbedPending = inngest.createFunction(
  {
    id: 'knowledge-embed-pending',
    triggers: { cron: '*/10 * * * *' },
  },
  async ({ step }) => {
    const tenants = await step.run('list-tenants', () => listActiveTenants(200));

    let embedded = 0;

    for (const tenant of tenants) {
      const result = await step.run(`embed-${tenant.id}`, () =>
        embedPendingKnowledgeChunks({ tenantId: tenant.id, limit: 96 })
      );
      embedded += result.embedded;
    }

    return {
      tenants: tenants.length,
      embedded,
    };
  }
);
