import { apiGetHttp } from '@apis/base_api';
import { mapOpenLibraryDocToBook, OpenLibraryBooksApi, parseIsbns } from './open_library_books_api';

jest.mock('@apis/base_api', () => ({
  apiGetHttp: jest.fn(),
}));

const mockApiGetHttp = apiGetHttp as jest.MockedFunction<typeof apiGetHttp>;

describe('Open Library mapping', () => {
  it('maps search doc fields to Book', () => {
    const book = mapOpenLibraryDocToBook({
      key: '/works/OL45804W',
      title: 'Why We Laugh',
      author_name: ['Sophie Scott'],
      first_publish_year: 2014,
      isbn: ['9780000000000', '0000000000'],
      cover_i: 12345,
    });

    expect(book.title).toBe('Why We Laugh');
    expect(book.author).toBe('Sophie Scott');
    expect(book.authors).toEqual(['Sophie Scott']);
    expect(book.publishDate).toBe('2014');
    expect(book.isbn13).toBe('9780000000000');
    expect(book.isbn10).toBe('0000000000');
    expect(book.link).toBe('https://openlibrary.org/works/OL45804W');
    expect(book.coverUrl).toBe('https://covers.openlibrary.org/b/id/12345-M.jpg');
  });

  it('parseIsbns splits 10- and 13-digit values', () => {
    expect(parseIsbns(['9780061876721', '0061876720'])).toEqual({
      isbn13: '9780061876721',
      isbn10: '0061876720',
      isbn: '9780061876721',
    });
  });
});

describe('OpenLibraryBooksApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests search.json with User-Agent and maps docs', async () => {
    mockApiGetHttp.mockResolvedValue({
      status: 200,
      bodyText: '{}',
      data: {
        docs: [{ title: 'Why We Laugh', author_name: ['Sophie Scott'], key: '/works/OL1W' }],
      },
      headers: {},
    });

    const api = new OpenLibraryBooksApi('reader@example.com', '1.0.0');
    const books = await api.getByQuery('why we laugh');

    expect(mockApiGetHttp).toHaveBeenCalledWith(
      'https://openlibrary.org/search.json',
      expect.objectContaining({ q: 'why we laugh', limit: 50 }),
      expect.objectContaining({
        'User-Agent': 'ObsidianBookSearchPlugin/1.0.0 (reader@example.com)',
      }),
    );
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Why We Laugh');
  });

  it('returns empty array for blank query without HTTP', async () => {
    const api = new OpenLibraryBooksApi('', '1.0.0');
    const books = await api.getByQuery('   ');
    expect(books).toEqual([]);
    expect(mockApiGetHttp).not.toHaveBeenCalled();
  });
});
