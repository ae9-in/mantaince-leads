import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service:     'admateine-leads-api',
    environment: process.env.NODE_ENV || 'development',
    version:     process.env.APP_VERSION || '1.0.0',
  },
  // In development, pretty-print logs. In production, print structured JSON.
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export default logger;
