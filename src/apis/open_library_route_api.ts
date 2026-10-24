import { Book } from '@models/book.model';
import { BaseBooksApiImpl } from './base_api';
import { GoogleBooksApi } from './google_books_api';
import { OpenLibraryBooksApi } from './open_library_books_api';

function bookDedupeKey(book: Book): string {
  const isbn = book.isbn13 ?? book.isbn10 ?? book.isbn;
  if (isbn) {
    return `isbn:${isbn.replace(/[^0-9Xx]/g, '')}`;
  }
  return `title:${book.title.trim().toLowerCase()}|${book.author.trim().toLowerCase()}`;
}

export function mergeBookSearchResults(primary: Book[], secondary: Book[]): Book[] {
  const seen = new Set(primary.map(bookDedupeKey));
  const merged = [...primary];
  for (const book of secondary) {
    const key = bookDedupeKey(book);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(book);
  }
  return merged;
}

export class OpenLibraryRouteApi implements BaseBooksApiImpl {
  constructor(
    private readonly openLibrary: OpenLibraryBooksApi,
    private readonly google: GoogleBooksApi | null,
    private readonly supplementWithGoogleBooks: boolean,
  ) {}

  async getByQuery(query: string, options?: Record<string, string>): Promise<Book[]> {
    const openLibraryResults = await this.openLibrary.getByQuery(query, options);
    const shouldQueryGoogle =
      this.google != null && (openLibraryResults.length === 0 || this.supplementWithGoogleBooks);

    if (!shouldQueryGoogle) {
      return openLibraryResults;
    }

    try {
      const googleResults = await this.google!.getByQuery(query, options);
      if (openLibraryResults.length === 0) {
        return googleResults;
      }
      return mergeBookSearchResults(openLibraryResults, googleResults);
    } catch (error) {
      if (openLibraryResults.length > 0) {
        console.warn('Google Books supplement failed; returning Open Library results.', error);
        return openLibraryResults;
      }
      throw error;
    }
  }
}
