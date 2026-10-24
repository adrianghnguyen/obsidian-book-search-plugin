export interface OpenLibrarySearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  edition_count?: number;
}

export interface OpenLibrarySearchResponse {
  numFound?: number;
  docs?: OpenLibrarySearchDoc[];
}
