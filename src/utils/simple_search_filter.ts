import { prepareSimpleSearch } from 'obsidian';

import { Book } from '@models/book.model';

/**
 * True when the query is empty (show all items) or any non-empty field matches via prepareSimpleSearch.
 */
export function anyFieldMatchesSimpleSearch(query: string, ...fields: (string | undefined | null)[]): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return true;
  }

  const match = prepareSimpleSearch(trimmed);
  return fields.some(field => {
    if (field == null || field === '') {
      return false;
    }
    return match(field) != null;
  });
}

export function filterBooksBySimpleSearch(books: Book[], query: string): Book[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return books;
  }

  const match = prepareSimpleSearch(trimmed);
  return books.filter(
    book =>
      (book.title && match(book.title) != null) ||
      (book.author && match(book.author) != null) ||
      (book.publisher && match(book.publisher) != null),
  );
}

export function pathMatchesSimpleSearch(path: string, query: string): boolean {
  return anyFieldMatchesSimpleSearch(query, path);
}
