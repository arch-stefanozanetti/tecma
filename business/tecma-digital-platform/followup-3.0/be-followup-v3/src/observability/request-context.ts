import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  correlationId: string;
  method?: string;
  endpoint?: string;
  userId?: string | null;
  workspaceId?: string | null;
}

const als = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, fn: () => T): T => als.run(context, fn);

export const getRequestContext = (): RequestContext | undefined => als.getStore();

export const updateRequestContext = (patch: Partial<RequestContext>): void => {
  const current = als.getStore();
  if (!current) return;
  Object.assign(current, patch);
};

