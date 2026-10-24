import { apiGetHttp, BaseBooksApiImpl, BookSearchProgressCallbacks } from '@apis/base_api';
import { Book } from '@models/book.model';
import { resolveGoogleBooksAuthRoute } from './google_books_auth';
import { GoogleBooksApiError, parseGoogleBooksErrorBody, userMessageForGoogleBooksError } from './google_books_errors';
import { googleBooksRequestGate } from './google_books_request_gate';
import { buildGoogleBooksVolumeSearchParams } from './google_books_search_params';
import { parseRetryAfterSeconds } from './google_books_throttle';
import { GoogleBooksResponse, VolumeInfo } from './models/google_books_response';

export class GoogleBooksApi implements BaseBooksApiImpl {
  constructor(
    private readonly localePreference: string,
    private readonly enableCoverImageEdgeCurl: boolean,
    private readonly apiKey?: string,
  ) {}

  async getByQuery(
    query: string,
    options?: Record<string, string>,
    progress?: BookSearchProgressCallbacks,
  ): Promise<Book[]> {
    try {
      progress?.onLegStart?.('google_books_fallback');
      const params = buildGoogleBooksVolumeSearchParams(query, this.localePreference, this.apiKey, options);
      const authRoute = resolveGoogleBooksAuthRoute(this.apiKey);
      googleBooksRequestGate.assertCanRequest(authRoute);
      googleBooksRequestGate.recordRequestStarted(authRoute);
      const http = await apiGetHttp<GoogleBooksResponse>('https://www.googleapis.com/books/v1/volumes', params);
      if (http.status >= 400) {
        if (http.status === 429) {
          googleBooksRequestGate.register429(authRoute, parseRetryAfterSeconds(http.headers));
        }
        const parsed = parseGoogleBooksErrorBody(http.status, http.bodyText);
        throw new GoogleBooksApiError(userMessageForGoogleBooksError(parsed, authRoute), authRoute, http.status);
      }
      const searchResults = http.data;
      if (!searchResults?.totalItems) return [];
      return searchResults.items.map(({ volumeInfo }) => this.createBookItem(volumeInfo));
    } catch (error) {
      console.warn(error);
      throw error;
    }
  }

  private extractISBNs(industryIdentifiers: VolumeInfo['industryIdentifiers']): Record<string, string> {
    return (
      industryIdentifiers?.reduce(
        (result, item) => {
          const isbnType = item.type === 'ISBN_10' ? 'isbn10' : 'isbn13';
          result[isbnType] = item.identifier.trim();
          return result;
        },
        {} as Record<string, string>,
      ) ?? {}
    );
  }

  private extractBasicBookInfo(item: VolumeInfo): Partial<Book> {
    return {
      title: item.title,
      subtitle: item.subtitle,
      author: this.formatList(item.authors),
      authors: item.authors,
      category: this.formatList(item.categories),
      categories: item.categories,
      publisher: item.publisher,
      totalPage: item.pageCount,
      coverUrl: this.setCoverImageEdgeCurl(item.imageLinks?.thumbnail ?? '', this.enableCoverImageEdgeCurl),
      coverSmallUrl: this.setCoverImageEdgeCurl(item.imageLinks?.smallThumbnail ?? '', this.enableCoverImageEdgeCurl),
      publishDate: item.publishedDate || '',
      description: item.description,
      link: item.canonicalVolumeLink || item.infoLink,
      previewLink: item.previewLink,
    };
  }

  public createBookItem(item: VolumeInfo): Book {
    const book: Book = {
      title: '',
      subtitle: '',
      author: '',
      authors: [],
      category: '',
      categories: [],
      publisher: '',
      publishDate: '',
      totalPage: '',
      coverUrl: '',
      coverSmallUrl: '',
      description: '',
      link: '',
      previewLink: '',
      ...this.extractBasicBookInfo(item),
      ...this.extractISBNs(item.industryIdentifiers),
    };
    return book;
  }

  public formatList(list?: string[]): string {
    return list && list.length > 1 ? list.map(item => item.trim()).join(', ') : list?.[0] ?? '';
  }

  private setCoverImageEdgeCurl(url: string, enabled: boolean): string {
    // Edge curl is included in the cover image URL parameters by default,
    // so we need to remove it if it's disabled
    return enabled ? url : url.replace('&edge=curl', '');
  }

  static convertGoogleBookImageURLSize(url: string, zoom: number) {
    return url.replace(/(&zoom)=\d/, `$1=${zoom}`);
  }
}
