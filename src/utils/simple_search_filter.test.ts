import { Book } from '@models/book.model';

import {
  anyFieldMatchesSimpleSearch,
  filterBooksBySimpleSearch,
  pathMatchesSimpleSearch,
} from './simple_search_filter';

const sampleBooks: Book[] = [
  {
    title: 'The Café at the End',
    author: 'Jane Müller',
    authors: ['Jane Müller'],
    publisher: 'Acme Press',
  },
  {
    title: 'Plain Title',
    author: 'John Doe',
    authors: ['John Doe'],
  },
  {
    title: 'Deep Work',
    author: 'Cal Newport',
    authors: ['Cal Newport'],
    publisher: 'Grand Central',
  },
];

describe('simple_search_filter', () => {
  describe('filterBooksBySimpleSearch', () => {
    it('returns all books when query is empty', () => {
      expect(filterBooksBySimpleSearch(sampleBooks, '')).toEqual(sampleBooks);
      expect(filterBooksBySimpleSearch(sampleBooks, '   ')).toEqual(sampleBooks);
    });

    it('matches title with accent-insensitive query', () => {
      const result = filterBooksBySimpleSearch(sampleBooks, 'cafe');
      expect(result.map(b => b.title)).toEqual(['The Café at the End']);
    });

    it('matches author with accent-insensitive query', () => {
      const result = filterBooksBySimpleSearch(sampleBooks, 'muller');
      expect(result.map(b => b.author)).toEqual(['Jane Müller']);
    });

    it('matches publisher field', () => {
      const result = filterBooksBySimpleSearch(sampleBooks, 'grand');
      expect(result.map(b => b.title)).toEqual(['Deep Work']);
    });

    it('requires all query words (simple search tokens)', () => {
      const result = filterBooksBySimpleSearch(sampleBooks, 'deep work');
      expect(result.map(b => b.title)).toEqual(['Deep Work']);
    });

    it('returns no books when no field matches', () => {
      expect(filterBooksBySimpleSearch(sampleBooks, 'nonexistent xyz')).toEqual([]);
    });
  });

  describe('anyFieldMatchesSimpleSearch', () => {
    it('matches any provided field', () => {
      expect(anyFieldMatchesSimpleSearch('acme', 'folder/notes', 'Acme Press')).toBe(true);
      expect(anyFieldMatchesSimpleSearch('missing', 'folder/notes')).toBe(false);
    });

    it('treats empty query as match-all', () => {
      expect(anyFieldMatchesSimpleSearch('', 'anything')).toBe(true);
    });
  });

  describe('pathMatchesSimpleSearch', () => {
    it('matches path substring with empty query', () => {
      expect(pathMatchesSimpleSearch('Books/Reading.md', '')).toBe(true);
    });

    it('matches path with prepareSimpleSearch', () => {
      expect(pathMatchesSimpleSearch('Books/Café Notes.md', 'cafe')).toBe(true);
      expect(pathMatchesSimpleSearch('Books/Plain.md', 'cafe')).toBe(false);
    });
  });
});
