import { Book } from '@models/book.model';
import { BaseBooksApiImpl } from './base_api';
import { mergeBookSearchResults, OpenLibraryRouteApi } from './open_library_route_api';

function stubProvider(results: Book[], leg?: import('@views/search_provider_pill').BookSearchLegId): BaseBooksApiImpl {
  return {
    getByQuery: jest.fn(async (_query, _options, progress) => {
      if (leg) {
        progress?.onLegStart?.(leg);
      }
      return results;
    }),
  };
}

describe('mergeBookSearchResults', () => {
  it('dedupes by ISBN when merging', () => {
    const primary: Book[] = [{ title: 'A', author: 'X', authors: [], isbn13: '9781111111111' }];
    const secondary: Book[] = [
      { title: 'A duplicate', author: 'X', authors: [], isbn13: '9781111111111' },
      { title: 'B', author: 'Y', authors: [], isbn13: '9782222222222' },
    ];
    const merged = mergeBookSearchResults(primary, secondary);
    expect(merged).toHaveLength(2);
    expect(merged[1].title).toBe('B');
  });
});

describe('OpenLibraryRouteApi fallback', () => {
  it('reports google fallback leg via progress when Open Library is empty', async () => {
    const openLibrary = stubProvider([], 'open_library');
    const google = stubProvider([{ title: 'From Google', author: '', authors: [] }]);
    const onLegStart = jest.fn();
    const route = new OpenLibraryRouteApi(openLibrary as never, google as never, false);

    await route.getByQuery('missing on ol', undefined, { onLegStart });

    expect(onLegStart).toHaveBeenCalledWith('open_library');
    expect(onLegStart).toHaveBeenCalledWith('google_books_fallback');
  });

  it('calls Google only when Open Library is empty and Google is configured', async () => {
    const openLibrary = stubProvider([], 'open_library');
    const google = stubProvider([{ title: 'From Google', author: '', authors: [] }]);
    const route = new OpenLibraryRouteApi(openLibrary as never, google as never, false);

    const results = await route.getByQuery('missing on ol');

    expect(openLibrary.getByQuery).toHaveBeenCalled();
    expect(google.getByQuery).toHaveBeenCalled();
    expect(results[0].title).toBe('From Google');
  });

  it('does not call Google when Open Library has hits and supplement is off', async () => {
    const openLibrary = stubProvider([{ title: 'OL hit', author: '', authors: [] }], 'open_library');
    const google = stubProvider([{ title: 'Google', author: '', authors: [] }]);
    const route = new OpenLibraryRouteApi(openLibrary as never, google as never, false);

    const results = await route.getByQuery('why we laugh');

    expect(google.getByQuery).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('OL hit');
  });

  it('supplements with Google when enabled and key-backed client exists', async () => {
    const openLibrary = stubProvider([{ title: 'OL hit', author: '', authors: [], isbn13: '9781111111111' }]);
    const google = stubProvider([{ title: 'Extra', author: '', authors: [], isbn13: '9782222222222' }]);
    const route = new OpenLibraryRouteApi(openLibrary as never, google as never, true);

    const results = await route.getByQuery('why we laugh');

    expect(google.getByQuery).toHaveBeenCalled();
    expect(results).toHaveLength(2);
  });

  it('skips Google when client is null even if supplement is on', async () => {
    const openLibrary = stubProvider([{ title: 'OL only', author: '', authors: [] }]);
    const route = new OpenLibraryRouteApi(openLibrary as never, null, true);

    const results = await route.getByQuery('query');
    expect(results[0].title).toBe('OL only');
  });
});
