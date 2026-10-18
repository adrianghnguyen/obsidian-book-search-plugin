#!/usr/bin/env node
/**
 * Live Google Books hammer smoke (5 requests within 20s).
 * Requires GOOGLE_BOOKS_API_KEY or book_search_gcp. Not part of `pnpm test`.
 * See internal/book-search/google-books-hammer-smoke-design.md in project store.
 */
const REQUEST_COUNT = 5;
const WINDOW_MS = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;
const STAGGER_MS = 4_000;

const key = (process.env.GOOGLE_BOOKS_API_KEY || process.env.book_search_gcp || '').trim();
if (!key) {
  console.error('FAIL: set GOOGLE_BOOKS_API_KEY or book_search_gcp');
  process.exit(2);
}

const burst = process.argv.includes('--burst');
const authRoute = 'api_key';

const plans = [
  { label: 'probe-1', build: () => probeUrl('connection-test') },
  { label: 'probe-2', build: () => probeUrl('connection-test') },
  { label: 'search-hobbit', build: () => searchUrl('hobbit') },
  { label: 'search-pride', build: () => searchUrl('pride prejudice') },
  { label: 'search-1984', build: () => searchUrl('1984') },
];

function probeUrl(q) {
  const u = new URL('https://www.googleapis.com/books/v1/volumes');
  u.searchParams.set('q', q);
  u.searchParams.set('maxResults', '1');
  u.searchParams.set('key', key);
  return u.href;
}

function searchUrl(q) {
  const u = new URL('https://www.googleapis.com/books/v1/volumes');
  u.searchParams.set('q', q);
  u.searchParams.set('maxResults', '40');
  u.searchParams.set('printType', 'books');
  u.searchParams.set('langRestrict', 'en');
  u.searchParams.set('key', key);
  return u.href;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchOne(label, url) {
  const start = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    const end = Date.now();
    const bodyText = await res.text();
    let totalItems = null;
    let routeHint = authRoute;
    let errorReason = null;
    try {
      const json = JSON.parse(bodyText);
      totalItems = typeof json?.totalItems === 'number' ? json.totalItems : null;
      errorReason = json?.error?.errors?.[0]?.reason ?? json?.error?.details?.[0]?.reason ?? null;
      const consumer = json?.error?.details?.[0]?.metadata?.consumer ?? '';
      if (consumer.includes('624717413613')) routeHint = 'anonymous_pool';
    } catch {
      errorReason = 'json_parse_failed';
    }
    return {
      label,
      ok: res.status === 200 && totalItems !== null,
      status: res.status,
      latencyMs: end - start,
      finishedAtMs: end,
      totalItems,
      routeHint,
      errorReason,
    };
  } catch (e) {
    const end = Date.now();
    return {
      label,
      ok: false,
      status: 0,
      latencyMs: end - start,
      finishedAtMs: end,
      totalItems: null,
      routeHint: authRoute,
      errorReason: e instanceof Error ? e.message : 'fetch_failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const t0 = Date.now();
  console.log(
    JSON.stringify({ event: 'start', authRoute, mode: burst ? 'burst' : 'staggered', windowMs: WINDOW_MS, requests: REQUEST_COUNT }),
  );

  const tasks = plans.map((plan, i) => {
    const delay = burst ? 0 : i * STAGGER_MS;
    return (async () => {
      if (delay) await sleep(delay);
      const scheduledAt = Date.now() - t0;
      const result = await fetchOne(plan.label, plan.build());
      return { ...result, scheduledAtMs: scheduledAt };
    })();
  });

  const results = await Promise.all(tasks);
  const windowEnd = t0 + WINDOW_MS;
  const launchesWithinWindow = results.every(r => r.scheduledAtMs <= WINDOW_MS);
  const allOk = results.every(r => r.ok);

  for (const r of results) {
    console.log(JSON.stringify({ event: 'request', ...r, finishAtMs: r.finishedAtMs - t0 }));
  }

  const pass = allOk && launchesWithinWindow;
  console.log(
    JSON.stringify({
      event: 'summary',
      summary: pass ? 'PASS' : 'FAIL',
      authRoute,
      allOk,
      launchesWithinWindow,
      windowMs: WINDOW_MS,
      elapsedMs: Date.now() - t0,
    }),
  );
  process.exit(pass ? 0 : 1);
}

main();
