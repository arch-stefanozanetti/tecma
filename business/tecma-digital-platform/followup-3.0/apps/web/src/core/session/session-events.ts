import type { SessionInvalidationEvent } from './session-types';

export const SESSION_INVALIDATED_EVENT_NAME = 'followup:session_invalidated';

export const emitSessionInvalidatedEvent = (detail: SessionInvalidationEvent): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SessionInvalidationEvent>(SESSION_INVALIDATED_EVENT_NAME, { detail }),
  );
};

export const subscribeSessionInvalidatedEvent = (
  listener: (event: SessionInvalidationEvent) => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (raw: Event) => {
    const detail = (raw as CustomEvent<SessionInvalidationEvent>).detail;
    if (detail == null) return;
    listener(detail);
  };
  window.addEventListener(SESSION_INVALIDATED_EVENT_NAME, handler);
  return () => window.removeEventListener(SESSION_INVALIDATED_EVENT_NAME, handler);
};
