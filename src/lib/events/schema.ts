import type { AutomationMode } from '@/lib/run-store';

export type Events = {
  'run.requested': {
    data: {
      tenant_id: string;
      run_id: string;
      goal: string;
      mode: AutomationMode;
      inputs: Record<string, unknown>;
    };
  };
  'run.step.completed': {
    data: {
      tenant_id: string;
      run_id: string;
      step: string;
    };
  };
  'run.cancelled': {
    data: {
      tenant_id: string;
      run_id: string;
    };
  };
  'approval.requested': {
    data: {
      tenant_id: string;
      run_id: string;
      approval_id: string;
    };
  };
  'approval.resolved': {
    data: {
      tenant_id: string;
      approval_id: string;
      decision: 'approved' | 'rejected';
      note?: string;
    };
  };
  'credentials.validate.scheduled': {
    data: Record<string, never>;
  };
  'brand.knowledge.sync.initial': {
    data: {
      tenant_id: string;
      brand_id?: string;
    };
  };
  'brand.knowledge.sync.delta': {
    data: {
      tenant_id: string;
    };
  };
  'knowledge.embed.pending': {
    data: {
      tenant_id: string;
      limit?: number;
    };
  };
  'metrics.refresh.tenant': {
    data: {
      tenant_id: string;
    };
  };
  'artifact.features.extract.daily': {
    data: {
      tenant_id: string;
    };
  };
  'competitors.scan.daily': {
    data: {
      tenant_id: string;
    };
  };
  'trends.detect.daily': {
    data: {
      tenant_id: string;
    };
  };
};
