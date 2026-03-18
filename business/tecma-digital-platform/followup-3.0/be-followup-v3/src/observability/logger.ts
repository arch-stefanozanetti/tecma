import pino from "pino";
import { ENV } from "../config/env.js";
import { getRequestContext } from "./request-context.js";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "be-followup-v3",
    env: ENV.APP_ENV,
  },
  mixin() {
    const context = getRequestContext();
    if (!context) return {};
    return {
      requestId: context.requestId,
      correlationId: context.correlationId,
      method: context.method,
      endpoint: context.endpoint,
      userId: context.userId ?? undefined,
      workspaceId: context.workspaceId ?? undefined,
    };
  },
});

