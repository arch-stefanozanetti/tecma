import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  traceId: string;
  userId?: string;
  workspaceId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  run<T>(ctx: RequestContext, cb: () => T): T {
    return storage.run(ctx, cb);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
};
