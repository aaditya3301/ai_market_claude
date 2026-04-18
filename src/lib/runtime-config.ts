import 'server-only';

export type AutomationMode = 'full' | 'guided' | 'simulation';

export interface RuntimeConfig {
  nodeEnv: string;
  isProduction: boolean;
  automationMode: AutomationMode;
  strictValidation: boolean;
  connectorTimestampSkewSeconds: number;
}

const AUTOMATION_MODES: AutomationMode[] = ['full', 'guided', 'simulation'];

function requireOneOf(envNames: string[]): string | null {
  for (const name of envNames) {
    const value = process.env[name];
    if (value && value.trim() !== '') {
      return name;
    }
  }
  return null;
}

function getAutomationMode(): AutomationMode {
  const mode = (process.env.AUTOMATION_MODE || 'simulation').toLowerCase();
  if (!AUTOMATION_MODES.includes(mode as AutomationMode)) {
    throw new Error(
      `RUNTIME_CONFIG_INVALID: AUTOMATION_MODE must be one of ${AUTOMATION_MODES.join(', ')}.`
    );
  }
  return mode as AutomationMode;
}

export function getRuntimeConfig(): RuntimeConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isProductionBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  const skewRaw = Number(process.env.CONNECTOR_TIMESTAMP_SKEW_SECONDS || 300);
  const connectorTimestampSkewSeconds = Number.isFinite(skewRaw) && skewRaw > 0 ? skewRaw : 300;

  return {
    nodeEnv,
    isProduction,
    automationMode: getAutomationMode(),
    strictValidation:
      (process.env.AUTOMATION_STRICT_VALIDATION === 'true' || isProduction) &&
      !isProductionBuildPhase,
    connectorTimestampSkewSeconds,
  };
}

/**
 * Phase 0 fail-fast runtime checks.
 * Throws on invalid production setup to avoid silent automation degradation.
 */
export function assertRuntimeConfiguration() {
  const config = getRuntimeConfig();

  if (!config.strictValidation) {
    return;
  }

  const missing: string[] = [];

  const requiredAlways = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'GEMINI_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  for (const key of requiredAlways) {
    if (!process.env[key] || process.env[key]?.trim() === '') {
      missing.push(key);
    }
  }

  if (config.automationMode === 'full' || config.automationMode === 'guided') {
    if (!process.env.POSTIZ_API_URL || process.env.POSTIZ_API_URL.trim() === '') {
      missing.push('POSTIZ_API_URL');
    }

    const postizKeyEnv = requireOneOf(['POSTIZ_API_KEY', 'NEXT_PUBLIC_POSTIZ_KEY']);
    if (!postizKeyEnv) {
      missing.push('POSTIZ_API_KEY or NEXT_PUBLIC_POSTIZ_KEY');
    }

    if (!process.env.CRON_SECRET || process.env.CRON_SECRET.trim() === '') {
      missing.push('CRON_SECRET');
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `RUNTIME_CONFIG_MISSING: Missing required environment variables for ${config.automationMode} mode: ${missing.join(', ')}`
    );
  }

  const requiredPhase1 = [
    'CREDENTIALS_MASTER_KEY',
    'CREDENTIALS_KEY_ID',
    'INNGEST_EVENT_KEY',
    'INNGEST_SIGNING_KEY',
    'WORKER_BASE_URL',
    'WORKER_SHARED_SECRET',
    'CONNECTOR_NONCE_REDIS_URL',
  ];

  const missingPhase1 = requiredPhase1.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
  if (missingPhase1.length > 0) {
    throw new Error(
      `RUNTIME_CONFIG_PHASE1_MISSING: Missing Phase 1 environment variables: ${missingPhase1.join(', ')}`
    );
  }
}
