import pino from 'pino';

export const appLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'authorization',
      'password',
      'refreshToken',
      'accessToken',
      '*.password',
      '*.refreshToken',
      '*.accessToken',
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const withBindings = (bindings: Record<string, unknown>) => appLogger.child(bindings);
