import {
  computeCooldownUntilFrom429,
  computeProactiveCooldownUntilMs,
  formatCooldownClock,
  GOOGLE_BOOKS_COOLDOWN_FALLBACK_MS,
  GOOGLE_BOOKS_KEYED_PROACTIVE_THRESHOLD,
  GOOGLE_BOOKS_SLIDING_WINDOW_MS,
  parseRetryAfterSeconds,
  pruneSlidingWindow,
} from './google_books_throttle';
import { GoogleBooksRequestGate } from './google_books_request_gate';

describe('google_books_throttle math', () => {
  const windowMs = GOOGLE_BOOKS_SLIDING_WINDOW_MS;
  const now = 1_700_000_000_000;

  it('prunes timestamps outside the sliding window', () => {
    const kept = pruneSlidingWindow([now - 61_000, now - 30_000, now - 1_000], now, windowMs);
    expect(kept).toEqual([now - 30_000, now - 1_000]);
  });

  it('formats M:SS countdown', () => {
    expect(formatCooldownClock(now, now + 65_000)).toBe('1:05');
    expect(formatCooldownClock(now, now + 4_200)).toBe('0:05');
    expect(formatCooldownClock(now, now)).toBe('0:00');
  });

  it('uses Retry-After for 429 cooldown', () => {
    const until = computeCooldownUntilFrom429(now, 45, [], windowMs, GOOGLE_BOOKS_COOLDOWN_FALLBACK_MS);
    expect(until).toBe(now + 45_000);
  });

  it('uses sliding window end when Retry-After is missing', () => {
    const timestamps = [now - 50_000, now - 10_000];
    const until = computeCooldownUntilFrom429(now, undefined, timestamps, windowMs, GOOGLE_BOOKS_COOLDOWN_FALLBACK_MS);
    expect(until).toBe(now - 50_000 + windowMs);
  });

  it('falls back to 60s when window is empty and no Retry-After', () => {
    const until = computeCooldownUntilFrom429(now, undefined, [], windowMs, GOOGLE_BOOKS_COOLDOWN_FALLBACK_MS);
    expect(until).toBe(now + GOOGLE_BOOKS_COOLDOWN_FALLBACK_MS);
  });

  it('parses Retry-After header case-insensitively', () => {
    expect(parseRetryAfterSeconds({ 'Retry-After': '12' })).toBe(12);
    expect(parseRetryAfterSeconds({ 'retry-after': '3' })).toBe(3);
    expect(parseRetryAfterSeconds({})).toBeUndefined();
  });

  it('enters proactive cooldown at threshold in window', () => {
    const timestamps = Array.from({ length: GOOGLE_BOOKS_KEYED_PROACTIVE_THRESHOLD }, (_, i) => now - i * 500);
    const until = computeProactiveCooldownUntilMs(now, timestamps, windowMs, GOOGLE_BOOKS_KEYED_PROACTIVE_THRESHOLD);
    expect(until).toBe(Math.min(...timestamps) + windowMs);
  });

  it('does not proactive-cooldown below threshold', () => {
    const timestamps = Array.from({ length: GOOGLE_BOOKS_KEYED_PROACTIVE_THRESHOLD - 1 }, (_, i) => now - i * 500);
    expect(
      computeProactiveCooldownUntilMs(now, timestamps, windowMs, GOOGLE_BOOKS_KEYED_PROACTIVE_THRESHOLD),
    ).toBeNull();
  });
});

describe('GoogleBooksRequestGate', () => {
  it('blocks while cooldown is active', () => {
    const gate = new GoogleBooksRequestGate();
    gate.register429('api_key', 30, 1_000);
    expect(() => gate.assertCanRequest('api_key', 1_500)).toThrow(/Wait 0:30/);
    gate.resetForTests();
  });
});
