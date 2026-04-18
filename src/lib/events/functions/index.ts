import { approvalsExpirySweep } from '@/lib/events/functions/scheduled/approvals-expiry';
import { credentialsValidator } from '@/lib/events/functions/scheduled/credentials-validator';
import { weeklyPlanningCycle } from '@/lib/events/functions/weekly-planning-cycle';

export const functions = [
  weeklyPlanningCycle,
  approvalsExpirySweep,
  credentialsValidator,
];
