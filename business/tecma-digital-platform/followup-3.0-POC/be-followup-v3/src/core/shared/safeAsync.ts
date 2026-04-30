import { logger } from "../../observability/logger.js";
import { observeAsyncSideEffectFailure } from "../../observability/metrics.js";

export interface SafeAsyncContext {
  operation: string;
  workspaceId?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  userId?: string;
}

export function safeAsync<T>(promise: Promise<T>, context: SafeAsyncContext): void {
  void promise.catch((err) => {
    observeAsyncSideEffectFailure({
      operation: context.operation,
      entityType: context.entityType,
    });
    logger.warn(
      {
        err,
        operation: context.operation,
        workspaceId: context.workspaceId,
        projectId: context.projectId,
        entityType: context.entityType,
        entityId: context.entityId,
        userId: context.userId,
      },
      "Async side-effect failed"
    );
  });
}
