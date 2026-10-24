import { apiGetHttp, BaseBooksApiImpl, BookSearchProgressCallbacks } from '@apis/base_api';
import { Book } from '@models/book.model';
import { buildOpenLibraryUserAgent } from './open_library_user_agent';
import { OpenLibrarySearchDoc, OpenLibrarySearchResponse } from './models/open_library_response';

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_SITE = 'https://openlibrary.org';

export const OPEN_LIBRARY_SEARCH_FIELDS = 'key,title,author_name,first_publish_year,isbn,cover_i,edition_count';

export function coverUrlFromCoverId(coverId: number, size: 'S' | 'M' | 'L'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

export function coverUrlFromIsbn(isbn: string, size: 'S' | 'M' | 'L'): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
}

export function parseIsbns(isbnList?: string[]): Pick<Book, 'isbn10' | 'isbn13' | 'isbn'> {
  if (!isbnList?.length) {
    return {};
  }
  let isbn10: string | undefined;
  let isbn13: string | undefined;
  for (const raw of isbnList) {
    const normalized = raw.replace(/[^0-9Xx]/g, '');
    if (normalized.length === 10 && !isbn10) {
      isbn10 = normalized;
    } else if (normalized.length === 13 && !isbn13) {
      isbn13 = normalized;
    }
  }
  const primary = isbn13 ?? isbn10;
  return {
    ...(isbn10 ? { isbn10 } : {}),
    ...(isbn13 ? { isbn13 } : {}),
    ...(primary ? { isbn: primary } : {}),
  };
}

export function formatAuthorList(authors?: string[]): { author: string; authors: string[] } {
  const list = authors?.map(name => name.trim()).filter(Boolean) ?? [];
  const author = list.length > 1 ? list.join(', ') : list[0] ?? '';
  return { author, authors: list };
}

export function mapOpenLibraryDocToBook(doc: OpenLibrarySearchDoc): Book {
  const { author, authors } = formatAuthorList(doc.author_name);
  const isbns = parseIsbns(doc.isbn);
  const coverMedium =
    doc.cover_i != null
      ? coverUrlFromCoverId(doc.cover_i, 'M')
      : isbns.isbn13
        ? coverUrlFromIsbn(isbns.isbn13, 'M')
        : isbns.isbn10
          ? coverUrlFromIsbn(isbns.isbn10, 'M')
          : '';
  const coverSmall =
    doc.cover_i != null
      ? coverUrlFromCoverId(doc.cover_i, 'S')
      : isbns.isbn13
        ? coverUrlFromIsbn(isbns.isbn13, 'S')
        : isbns.isbn10
          ? coverUrlFromIsbn(isbns.isbn10, 'S')
          : '';
  const coverLarge =
    doc.cover_i != null
      ? coverUrlFromCoverId(doc.cover_i, 'L')
      : isbns.isbn13
        ? coverUrlFromIsbn(isbns.isbn13, 'L')
        : isbns.isbn10
          ? coverUrlFromIsbn(isbns.isbn10, 'L')
          : '';

  const link = doc.key ? `${OPEN_LIBRARY_SITE}${doc.key}` : undefined;
  const publishDate =
    doc.first_publish_year != null && !Number.isNaN(doc.first_publish_year) ? String(doc.first_publish_year) : '';

  return {
    title: doc.title?.trim() ?? '',
    author,
    authors,
    publishDate,
    coverUrl: coverMedium,
    coverSmallUrl: coverSmall,
    coverMediumUrl: coverMedium,
    coverLargeUrl: coverLarge,
    link,
    ...isbns,
  };
}

export class OpenLibraryBooksApi implements BaseBooksApiImpl {
  constructor(
    private readonly contactEmail: string | undefined,
    private readonly pluginVersion: string | undefined,
  ) {}

  async getByQuery(
    query: string,
    _options?: Record<string, string>,
    progress?: BookSearchProgressCallbacks,
  ): Promise<Book[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    progress?.onLegStart?.('open_library');
    const userAgent = buildOpenLibraryUserAgent(this.contactEmail, this.pluginVersion);
    const http = await apiGetHttp<OpenLibrarySearchResponse>(
      OPEN_LIBRARY_SEARCH_URL,
      {
        q: trimmed,
        limit: 50,
        fields: OPEN_LIBRARY_SEARCH_FIELDS,
      },
      { 'User-Agent': userAgent },
    );

    if (http.status >= 400) {
      throw new Error(`Open Library search failed (${http.status}).`);
    }

    const docs = http.data?.docs ?? [];
    return docs.map(mapOpenLibraryDocToBook).filter(book => book.title.length > 0);
  }
}
