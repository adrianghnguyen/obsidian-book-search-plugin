export type GoogleBooksAuthRoute = 'api_key' | 'anonymous_pool';

/** Known shared consumer project number in Google Books anonymous errors. */
export const GOOGLE_BOOKS_ANONYMOUS_CONSUMER_HINT = '624717413613';

export function resolveGoogleBooksAuthRoute(apiKey: string | undefined): GoogleBooksAuthRoute {
  return apiKey?.trim() ? 'api_key' : 'anonymous_pool';
}

export function googleBooksAuthRouteLabel(route: GoogleBooksAuthRoute): {
  short: string;
  settingsLine: string;
  settingsDetail: string;
} {
  if (route === 'api_key') {
    return {
      short: 'Your API key',
      settingsLine: 'Search route: your Google Cloud API key',
      settingsDetail:
        'Requests include your linked key and count against that Cloud project’s Books API quota (not the shared anonymous pool).',
    };
  }
  return {
    short: 'Shared anonymous pool',
    settingsLine: 'Search route: shared anonymous pool (no API key)',
    settingsDetail:
      'Requests omit a key and use Google’s shared consumer pool with strict limits. Link an API key above for reliable search.',
  };
}

export function authRoutePrefix(route: GoogleBooksAuthRoute): string {
  return route === 'api_key' ? 'Your API key:' : 'Shared anonymous pool:';
}
