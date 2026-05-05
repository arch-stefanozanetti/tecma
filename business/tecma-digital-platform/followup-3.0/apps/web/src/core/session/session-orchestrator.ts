import { emitSessionInvalidatedEvent } from './session-events';
import { clearSessionStorage } from './session-storage';
import type {
  SessionInvalidationMarker,
  SessionInvalidationOptions,
  SessionStorageStrategy,
} from './session-types';

export const SESSION_INVALIDATED_AT_KEY = 'followup.session_invalidated_at';

class SessionOrchestrator {
  private invalidating = false;
  private initialized = false;
  private applyingRemoteMarker = false;

  initMultiTabSync(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;
    window.addEventListener('storage', (event) => {
      if (event.key !== SESSION_INVALIDATED_AT_KEY || event.newValue == null) return;
      const marker = this.parseMarker(event.newValue);
      if (marker == null) return;
      void this.invalidateSession({
        reason: marker.reason,
        source: 'cross_tab',
        redirectToLogin: marker.redirectToLogin,
        strategy: 'auth-only',
        writeMarker: false,
      });
    });
  }

  async invalidateSession(options: SessionInvalidationOptions): Promise<boolean> {
    if (this.invalidating) return false;
    this.invalidating = true;
    try {
      await Promise.resolve();
      const strategy: SessionStorageStrategy = options.strategy ?? 'auth-only';
      clearSessionStorage(strategy);
      const event = {
        reason: options.reason,
        source: options.source,
        redirectToLogin: options.redirectToLogin ?? true,
        at: new Date().toISOString(),
      };
      emitSessionInvalidatedEvent(event);
      if (options.writeMarker !== false && !this.applyingRemoteMarker && typeof window !== 'undefined') {
        const marker: SessionInvalidationMarker = {
          ...event,
          markerId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()),
        };
        window.localStorage.setItem(SESSION_INVALIDATED_AT_KEY, JSON.stringify(marker));
      }
      return true;
    } finally {
      this.invalidating = false;
      this.applyingRemoteMarker = false;
    }
  }

  private parseMarker(raw: string): SessionInvalidationMarker | null {
    try {
      this.applyingRemoteMarker = true;
      const parsed = JSON.parse(raw) as Partial<SessionInvalidationMarker>;
      if (
        typeof parsed.reason !== 'string' ||
        typeof parsed.source !== 'string' ||
        typeof parsed.at !== 'string'
      ) {
        return null;
      }
      return {
        reason: parsed.reason as SessionInvalidationMarker['reason'],
        source: parsed.source as SessionInvalidationMarker['source'],
        at: parsed.at,
        redirectToLogin: parsed.redirectToLogin !== false,
        markerId:
          typeof parsed.markerId === 'string' && parsed.markerId.trim() !== ''
            ? parsed.markerId
            : 'remote',
      };
    } catch {
      return null;
    }
  }
}

const orchestrator = new SessionOrchestrator();

export const sessionOrchestrator = orchestrator;
