import { type GoogleBooksAuthRoute } from './google_books_auth';
import {
  computeCooldownUntilFrom429,
  computeProactiveCooldownUntilMs,
  formatCooldownClock,
  GOOGLE_BOOKS_COOLDOWN_FALLBACK_MS,
  GOOGLE_BOOKS_KEYED_PROACTIVE_THRESHOLD,
  GOOGLE_BOOKS_SLIDING_WINDOW_MS,
  GoogleBooksThrottleError,
  pruneSlidingWindow,
  waitMessageForGoogleBooks,
} from './google_books_throttle';

type GateListener = () => void;

export class GoogleBooksRequestGate {
  private cooldownUntilMs = 0;
  private keyedRequestTimestampsMs: number[] = [];
  private listeners = new Set<GateListener>();
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  getCooldownUntilMs(nowMs = Date.now()): number {
    return nowMs < this.cooldownUntilMs ? this.cooldownUntilMs : 0;
  }

  isInCooldown(nowMs = Date.now()): boolean {
    return nowMs < this.cooldownUntilMs;
  }

  subscribe(listener: GateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Throws when search or Test connection must wait. */
  assertCanRequest(authRoute: GoogleBooksAuthRoute, nowMs = Date.now()): void {
    const blockedUntil = this.getCooldownUntilMs(nowMs);
    if (blockedUntil > nowMs) {
      throw this.buildThrottleError(authRoute, blockedUntil, nowMs);
    }

    if (authRoute === 'api_key') {
      const proactiveUntil = computeProactiveCooldownUntilMs(
        nowMs,
        this.keyedRequestTimestampsMs,
        GOOGLE_BOOKS_SLIDING_WINDOW_MS,
        GOOGLE_BOOKS_KEYED_PROACTIVE_THRESHOLD,
      );
      if (proactiveUntil !== null && proactiveUntil > nowMs) {
        this.cooldownUntilMs = Math.max(this.cooldownUntilMs, proactiveUntil);
        this.startTickIfNeeded();
        this.notify();
        throw this.buildThrottleError(authRoute, this.cooldownUntilMs, nowMs);
      }
    }
  }

  recordRequestStarted(authRoute: GoogleBooksAuthRoute, nowMs = Date.now()): void {
    if (authRoute !== 'api_key') {
      return;
    }
    this.keyedRequestTimestampsMs = pruneSlidingWindow(
      [...this.keyedRequestTimestampsMs, nowMs],
      nowMs,
      GOOGLE_BOOKS_SLIDING_WINDOW_MS,
    );
  }

  register429(authRoute: GoogleBooksAuthRoute, retryAfterSeconds: number | undefined, nowMs = Date.now()): void {
    const until = computeCooldownUntilFrom429(
      nowMs,
      retryAfterSeconds,
      authRoute === 'api_key' ? this.keyedRequestTimestampsMs : [],
      GOOGLE_BOOKS_SLIDING_WINDOW_MS,
      GOOGLE_BOOKS_COOLDOWN_FALLBACK_MS,
    );
    this.cooldownUntilMs = Math.max(this.cooldownUntilMs, until);
    this.startTickIfNeeded();
    this.notify();
  }

  statusLine(authRoute: GoogleBooksAuthRoute, nowMs = Date.now()): string | null {
    const until = this.getCooldownUntilMs(nowMs);
    if (!until) {
      return null;
    }
    return waitMessageForGoogleBooks(authRoute, formatCooldownClock(nowMs, until));
  }

  resetForTests(): void {
    this.cooldownUntilMs = 0;
    this.keyedRequestTimestampsMs = [];
    this.stopTick();
    this.notify();
  }

  private buildThrottleError(
    authRoute: GoogleBooksAuthRoute,
    untilMs: number,
    nowMs: number,
  ): GoogleBooksThrottleError {
    const clock = formatCooldownClock(nowMs, untilMs);
    return new GoogleBooksThrottleError(waitMessageForGoogleBooks(authRoute, clock), authRoute, untilMs);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private startTickIfNeeded(): void {
    if (this.tickHandle !== null) {
      return;
    }
    this.tickHandle = setInterval(() => {
      const nowMs = Date.now();
      if (!this.isInCooldown(nowMs)) {
        this.stopTick();
      }
      this.notify();
    }, 1000);
  }

  private stopTick(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }
}

export const googleBooksRequestGate = new GoogleBooksRequestGate();
