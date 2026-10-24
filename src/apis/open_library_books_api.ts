import { apiGetHttp, BaseBooksApiImpl, BookSearchProgressCallbacks } from '@apis/base_api';
import { Book } from '@models/book.model';
import { buildOpenLibraryUserAgent } from './open_library_user_agent';
import {
  OpenLibrarySearchDoc,
  OpenLibrarySearchResponse,
  OpenLibraryWorkResponse,
} from './models/open_library_response';

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_SITE = 'https://openlibrary.org';

export const OPEN_LIBRARY_SEARCH_FIELDS =
  'key,title,subtitle,author_name,first_publish_year,isbn,cover_i,edition_count,subject,publisher,language,number_of_pages_median,first_sentence';

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

export function formatStringList(values?: string[]): { formatted: string; list: string[] } {
  const list = values?.map(value => value.trim()).filter(Boolean) ?? [];
  const formatted = list.length > 1 ? list.join(', ') : list[0] ?? '';
  return { formatted, list };
}

export function parseOpenLibraryDescription(description?: OpenLibraryWorkResponse['description']): string | undefined {
  if (description == null) {
    return undefined;
  }
  if (typeof description === 'string') {
    const trimmed = description.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  const trimmed = description.value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function workKeyFromBookLink(link?: string): string | null {
  if (!link?.trim()) {
    return null;
  }
  try {
    const url = new URL(link);
    if (!url.hostname.includes('openlibrary.org')) {
      return null;
    }
    const match = url.pathname.match(/^\/works\/(OL\d+W)/i);
    return match ? `/works/${match[1]}` : null;
  } catch {
    return null;
  }
}

function firstPositiveCoverId(covers?: number[]): number | undefined {
  return covers?.find(id => typeof id === 'number' && id > 0);
}

function buildCoverUrls(
  coverId: number | undefined,
  isbns: Pick<Book, 'isbn10' | 'isbn13'>,
): {
  coverSmall: string;
  coverMedium: string;
  coverLarge: string;
} {
  if (coverId != null) {
    return {
      coverSmall: coverUrlFromCoverId(coverId, 'S'),
      coverMedium: coverUrlFromCoverId(coverId, 'M'),
      coverLarge: coverUrlFromCoverId(coverId, 'L'),
    };
  }
  const isbnForCover = isbns.isbn13 ?? isbns.isbn10;
  if (isbnForCover) {
    return {
      coverSmall: coverUrlFromIsbn(isbnForCover, 'S'),
      coverMedium: coverUrlFromIsbn(isbnForCover, 'M'),
      coverLarge: coverUrlFromIsbn(isbnForCover, 'L'),
    };
  }
  return { coverSmall: '', coverMedium: '', coverLarge: '' };
}

export function mapOpenLibraryDocToBook(doc: OpenLibrarySearchDoc): Book {
  const { author, authors } = formatAuthorList(doc.author_name);
  const isbns = parseIsbns(doc.isbn);
  const { coverSmall, coverMedium, coverLarge } = buildCoverUrls(doc.cover_i, isbns);
  const { formatted: publisher } = formatStringList(doc.publisher);
  const { formatted: category, list: categories } = formatStringList(doc.subject);
  const { formatted: language } = formatStringList(doc.language);
  const firstSentence = doc.first_sentence?.map(s => s.trim()).find(Boolean);

  const link = doc.key ? `${OPEN_LIBRARY_SITE}${doc.key}` : undefined;
  const publishDate =
    doc.first_publish_year != null && !Number.isNaN(doc.first_publish_year) ? String(doc.first_publish_year) : '';

  return {
    title: doc.title?.trim() ?? '',
    ...(doc.subtitle?.trim() ? { subtitle: doc.subtitle.trim() } : {}),
    author,
    authors,
    ...(publisher ? { publisher } : {}),
    ...(category ? { category, categories } : {}),
    ...(language ? { language } : {}),
    publishDate,
    ...(doc.number_of_pages_median != null && doc.number_of_pages_median > 0
      ? { totalPage: doc.number_of_pages_median }
      : {}),
    coverUrl: coverMedium,
    coverSmallUrl: coverSmall,
    coverMediumUrl: coverMedium,
    coverLargeUrl: coverLarge,
    ...(firstSentence ? { description: firstSentence } : {}),
    link,
    ...isbns,
  };
}

export function mergeOpenLibraryWorkIntoBook(book: Book, work: OpenLibraryWorkResponse): Book {
  const merged: Book = { ...book };
  const workDescription = parseOpenLibraryDescription(work.description);
  if (workDescription && (!merged.description || merged.description.length < workDescription.length)) {
    merged.description = workDescription;
  }

  if (work.subtitle?.trim() && !merged.subtitle) {
    merged.subtitle = work.subtitle.trim();
  }

  if (work.subjects?.length && (!merged.categories?.length || !merged.category)) {
    const { formatted, list } = formatStringList(work.subjects);
    if (formatted) {
      merged.category = formatted;
      merged.categories = list;
    }
  }

  if (!merged.coverUrl) {
    const coverId = firstPositiveCoverId(work.covers);
    if (coverId != null) {
      const isbns = { isbn10: merged.isbn10, isbn13: merged.isbn13 };
      const covers = buildCoverUrls(coverId, isbns);
      merged.coverUrl = covers.coverMedium;
      merged.coverSmallUrl = covers.coverSmall;
      merged.coverMediumUrl = covers.coverMedium;
      merged.coverLargeUrl = covers.coverLarge;
    }
  }

  return merged;
}

export async function enrichOpenLibraryBook(
  book: Book,
  contactEmail: string | undefined,
  pluginVersion: string | undefined,
): Promise<Book> {
  const workKey = workKeyFromBookLink(book.link);
  if (!workKey) {
    return book;
  }

  const userAgent = buildOpenLibraryUserAgent(contactEmail, pluginVersion);
  try {
    const http = await apiGetHttp<OpenLibraryWorkResponse>(
      `${OPEN_LIBRARY_SITE}${workKey}.json`,
      {},
      {
        'User-Agent': userAgent,
      },
    );
    if (http.status >= 400 || !http.data) {
      return book;
    }
    return mergeOpenLibraryWorkIntoBook(book, http.data);
  } catch (error) {
    console.warn('Open Library work enrichment failed; using search metadata only.', error);
    return book;
  }
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
