import { inngest } from '@/lib/events/client';
import { listActiveTenants } from '@/lib/intelligence/tenants';
import { extractWinnerFeaturesForTenant } from '@/lib/intelligence/metrics';

export const winnerFeaturesExtract = inngest.createFunction(
  {
    id: 'winner-features-extract',
    triggers: { cron: '15 3 * * *' },
  },
  async ({ step }) => {
    const tenants = await step.run('list-tenants', () => listActiveTenants(200));

    let extracted = 0;

    for (const tenant of tenants) {
      const result = await step.run(`extract-winner-features-${tenant.id}`, () =>
        extractWinnerFeaturesForTenant(tenant.id)
      );
      extracted += result.extracted;
    }

    return {
      tenants: tenants.length,
      extracted,
    };
  }
);
