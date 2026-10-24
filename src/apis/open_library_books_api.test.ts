import { apiGetHttp } from '@apis/base_api';
import {
  enrichOpenLibraryBook,
  mapOpenLibraryDocToBook,
  mergeOpenLibraryWorkIntoBook,
  OpenLibraryBooksApi,
  parseIsbns,
  parseOpenLibraryDescription,
  workKeyFromBookLink,
} from './open_library_books_api';

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
    expect(book.coverLargeUrl).toBe('https://covers.openlibrary.org/b/id/12345-L.jpg');
  });

  it('maps extended search fields (subjects, publisher, pages, language)', () => {
    const book = mapOpenLibraryDocToBook({
      title: 'Why we laugh',
      subject: ['Psychology', 'Humor'],
      publisher: ['Harper & Brothers', 'Harper'],
      language: ['eng'],
      number_of_pages_median: 448,
      first_sentence: ['Laughter is universal.'],
      subtitle: 'A science of mirth',
    });

    expect(book.subtitle).toBe('A science of mirth');
    expect(book.publisher).toBe('Harper & Brothers, Harper');
    expect(book.category).toBe('Psychology, Humor');
    expect(book.categories).toEqual(['Psychology', 'Humor']);
    expect(book.language).toBe('eng');
    expect(book.totalPage).toBe(448);
    expect(book.description).toBe('Laughter is universal.');
  });

  it('parseIsbns splits 10- and 13-digit values', () => {
    expect(parseIsbns(['9780061876721', '0061876720'])).toEqual({
      isbn13: '9780061876721',
      isbn10: '0061876720',
      isbn: '9780061876721',
    });
  });

  it('parseOpenLibraryDescription handles string and object forms', () => {
    expect(parseOpenLibraryDescription('Plain text')).toBe('Plain text');
    expect(parseOpenLibraryDescription({ type: '/type/text', value: 'Object text' })).toBe('Object text');
  });

  it('workKeyFromBookLink extracts work keys from Open Library URLs', () => {
    expect(workKeyFromBookLink('https://openlibrary.org/works/OL45804W')).toBe('/works/OL45804W');
    expect(workKeyFromBookLink('https://books.google.com/volume')).toBeNull();
  });

  it('mergeOpenLibraryWorkIntoBook fills description and covers from work', () => {
    const base = mapOpenLibraryDocToBook({
      title: 'Fantastic Mr Fox',
      key: '/works/OL45804W',
      author_name: ['Roald Dahl'],
    });

    const merged = mergeOpenLibraryWorkIntoBook(base, {
      description: 'Longer work description.',
      subjects: ['Animals', 'Foxes'],
      covers: [6498519, -1],
    });

    expect(merged.description).toBe('Longer work description.');
    expect(merged.categories).toEqual(['Animals', 'Foxes']);
    expect(merged.coverUrl).toBe('https://covers.openlibrary.org/b/id/6498519-M.jpg');
  });
});

describe('enrichOpenLibraryBook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches work.json once when the book link is an Open Library work', async () => {
    mockApiGetHttp.mockResolvedValue({
      status: 200,
      bodyText: '{}',
      data: { description: 'From work API.' },
      headers: {},
    });

    const book = mapOpenLibraryDocToBook({
      title: 'Test',
      key: '/works/OL1W',
      author_name: ['Author'],
    });

    const enriched = await enrichOpenLibraryBook(book, 'reader@example.com', '1.0.0');

    expect(mockApiGetHttp).toHaveBeenCalledWith(
      'https://openlibrary.org/works/OL1W.json',
      {},
      expect.objectContaining({
        'User-Agent': 'ObsidianBookSearchPlugin/1.0.0 (reader@example.com)',
      }),
    );
    expect(enriched.description).toBe('From work API.');
  });

  it('skips HTTP when link is not Open Library', async () => {
    const enriched = await enrichOpenLibraryBook(
      { title: 'T', author: 'A', authors: ['A'], link: 'https://example.com' },
      '',
      '1.0.0',
    );
    expect(enriched.link).toBe('https://example.com');
    expect(mockApiGetHttp).not.toHaveBeenCalled();
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
