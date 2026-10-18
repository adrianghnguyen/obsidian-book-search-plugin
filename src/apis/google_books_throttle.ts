import { authRoutePrefix, type GoogleBooksAuthRoute } from './google_books_auth';

export const GOOGLE_BOOKS_SLIDING_WINDOW_MS = 60_000;
export const GOOGLE_BOOKS_COOLDOWN_FALLBACK_MS = 60_000;
/** Keyed route: pre-empt cooldown when this many requests fall in the sliding window. */
export const GOOGLE_BOOKS_KEYED_PROACTIVE_THRESHOLD = 95;

export class GoogleBooksThrottleError extends Error {
  readonly authRoute: GoogleBooksAuthRoute;
  readonly cooldownUntilMs: number;

  constructor(message: string, authRoute: GoogleBooksAuthRoute, cooldownUntilMs: number) {
    super(message);
    this.name = 'GoogleBooksThrottleError';
    this.authRoute = authRoute;
    this.cooldownUntilMs = cooldownUntilMs;
  }
}

export function pruneSlidingWindow(timestampsMs: number[], nowMs: number, windowMs: number): number[] {
  const cutoff = nowMs - windowMs;
  return timestampsMs.filter(t => t > cutoff);
}

export function formatCooldownClock(nowMs: number, cooldownUntilMs: number): string {
  const remainingSec = Math.max(0, Math.ceil((cooldownUntilMs - nowMs) / 1000));
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function waitMessageForGoogleBooks(authRoute: GoogleBooksAuthRoute, clock: string): string {
  const routeHint =
    authRoute === 'api_key'
      ? `${authRoutePrefix(authRoute)} Wait ${clock} until the next Google Books request.`
      : `${authRoutePrefix(authRoute)} Wait ${clock} until the next Google Books request.`;
  return routeHint;
}

export function computeCooldownUntilFrom429(
  nowMs: number,
  retryAfterSeconds: number | undefined,
  requestTimestampsMs: number[],
  windowMs: number,
  fallbackMs: number,
): number {
  if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return nowMs + retryAfterSeconds * 1000;
  }
  const pruned = pruneSlidingWindow(requestTimestampsMs, nowMs, windowMs);
  if (pruned.length > 0) {
    return Math.min(...pruned) + windowMs;
  }
  return nowMs + fallbackMs;
}

export function computeProactiveCooldownUntilMs(
  nowMs: number,
  requestTimestampsMs: number[],
  windowMs: number,
  threshold: number,
): number | null {
  const pruned = pruneSlidingWindow(requestTimestampsMs, nowMs, windowMs);
  if (pruned.length < threshold) {
    return null;
  }
  return Math.min(...pruned) + windowMs;
}

export function parseRetryAfterSeconds(headers: Record<string, string> | undefined): number | undefined {
  if (!headers) {
    return undefined;
  }
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  if (!raw?.trim()) {
    return undefined;
  }
  const seconds = Number(raw.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }
  return undefined;
}

export const GOOGLE_BOOKS_KEYED_RATE_HINT =
  'Keyed traffic allows roughly 100 searches per minute; normal manual use is fine; rapid repeated searches may briefly pause with a countdown.';
