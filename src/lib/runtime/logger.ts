import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'ai_market_web',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});
