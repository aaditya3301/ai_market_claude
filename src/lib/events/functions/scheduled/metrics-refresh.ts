import { inngest } from '@/lib/events/client';
import { listActiveTenants } from '@/lib/intelligence/tenants';
import { refreshArtifactMetricsForTenant, scoreArtifactsForTenant } from '@/lib/intelligence/metrics';

export const metricsRefreshTenant = inngest.createFunction(
  {
    id: 'metrics-refresh-tenant',
    triggers: { cron: '0 */6 * * *' },
  },
  async ({ step }) => {
    const tenants = await step.run('list-tenants', () => listActiveTenants(200));

    let inserted = 0;
    let scored = 0;

    for (const tenant of tenants) {
      const metrics = await step.run(`refresh-metrics-${tenant.id}`, () =>
        refreshArtifactMetricsForTenant(tenant.id)
      );
      inserted += metrics.inserted;

      const scores = await step.run(`score-metrics-${tenant.id}`, () =>
        scoreArtifactsForTenant(tenant.id)
      );
      scored += scores.scored;
    }

    return {
      tenants: tenants.length,
      inserted,
      scored,
    };
  }
);
