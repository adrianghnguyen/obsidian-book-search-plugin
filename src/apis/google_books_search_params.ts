const MAX_RESULTS = 40;
const PRINT_TYPE = 'books';

function getLanguageRestriction(local: string): string {
  return local === 'default' ? window.moment.locale() : local;
}

/** Pure helper — used by GoogleBooksApi and unit tests (key on wire). */
export function buildGoogleBooksVolumeSearchParams(
  query: string,
  localePreference: string,
  apiKey: string | undefined,
  options?: Record<string, string>,
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    q: query,
    maxResults: MAX_RESULTS,
    printType: PRINT_TYPE,
    langRestrict: getLanguageRestriction(options?.locale || localePreference),
  };

  const trimmedKey = apiKey?.trim();
  if (trimmedKey) {
    params.key = trimmedKey;
  }
  return params;
}

export function googleBooksVolumeRequestIncludesApiKey(params: Record<string, string | number>): boolean {
  const key = params.key;
  return typeof key === 'string' && key.length > 0;
}
