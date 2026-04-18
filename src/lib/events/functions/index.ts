import { knowledgeSyncDeltaEvent } from '@/lib/events/functions/intelligence/knowledge-sync-delta-event';
import { knowledgeSyncInitial } from '@/lib/events/functions/intelligence/knowledge-sync-initial';
import { approvalsExpirySweep } from '@/lib/events/functions/scheduled/approvals-expiry';
import { competitorsScanDaily } from '@/lib/events/functions/scheduled/competitors-scan-daily';
import { credentialsValidator } from '@/lib/events/functions/scheduled/credentials-validator';
import { knowledgeEmbedPending } from '@/lib/events/functions/scheduled/knowledge-embed-pending';
import { knowledgeSyncDelta } from '@/lib/events/functions/scheduled/knowledge-sync-delta';
import { metricsRefreshTenant } from '@/lib/events/functions/scheduled/metrics-refresh';
import { trendsDetectDaily } from '@/lib/events/functions/scheduled/trends-detect-daily';
import { winnerFeaturesExtract } from '@/lib/events/functions/scheduled/winner-features-extract';
import { weeklyPlanningCycle } from '@/lib/events/functions/weekly-planning-cycle';

export const functions = [
  weeklyPlanningCycle,
  knowledgeSyncInitial,
  knowledgeSyncDeltaEvent,
  knowledgeSyncDelta,
  knowledgeEmbedPending,
  metricsRefreshTenant,
  winnerFeaturesExtract,
  competitorsScanDaily,
  trendsDetectDaily,
  approvalsExpirySweep,
  credentialsValidator,
];
