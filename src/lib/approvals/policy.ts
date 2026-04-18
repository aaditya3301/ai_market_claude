import type { AutomationMode } from '@/lib/run-store';

export type ApprovalActionContext = {
  tenantId: string;
  action: string;
  mode: AutomationMode;
  budgetImpactUsd?: number;
  isPublic?: boolean;
};

export function requiresApproval(ctx: ApprovalActionContext): boolean {
  if (ctx.mode === 'simulation') {
    return false;
  }

  if (ctx.mode === 'full') {
    return ctx.budgetImpactUsd != null || ctx.isPublic === true;
  }

  return Boolean(ctx.budgetImpactUsd != null || ctx.isPublic === true);
}
