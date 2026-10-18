import {
  buildGoogleBooksVolumeSearchParams,
  googleBooksVolumeRequestIncludesApiKey,
} from './google_books_search_params';

describe('google books search params', () => {
  it('includes key param when apiKey is linked', () => {
    const params = buildGoogleBooksVolumeSearchParams('flow', 'en', '  AIza-test-key  ');
    expect(params.key).toBe('AIza-test-key');
    expect(googleBooksVolumeRequestIncludesApiKey(params)).toBe(true);
  });

  it('omits key param when apiKey is empty', () => {
    const params = buildGoogleBooksVolumeSearchParams('flow', 'en', '   ');
    expect(params.key).toBeUndefined();
    expect(googleBooksVolumeRequestIncludesApiKey(params)).toBe(false);
  });
});
