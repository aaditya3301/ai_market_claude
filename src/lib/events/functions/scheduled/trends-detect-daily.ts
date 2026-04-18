import { inngest } from '@/lib/events/client';
import { listActiveTenants } from '@/lib/intelligence/tenants';
import { detectTrendSignalsForTenant } from '@/lib/intelligence/trends';

export const trendsDetectDaily = inngest.createFunction(
  {
    id: 'trends-detect-daily',
    triggers: { cron: '30 4 * * *' },
  },
  async ({ step }) => {
    const tenants = await step.run('list-tenants', () => listActiveTenants(200));

    let inserted = 0;

    for (const tenant of tenants) {
      const result = await step.run(`detect-trends-${tenant.id}`, () =>
        detectTrendSignalsForTenant(tenant.id)
      );
      inserted += result.inserted;
    }

    return {
      tenants: tenants.length,
      inserted,
    };
  }
);
