export interface OpenLibrarySearchDoc {
  key?: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  edition_count?: number;
  subject?: string[];
  publisher?: string[];
  language?: string[];
  number_of_pages_median?: number;
  first_sentence?: string[];
}

export interface OpenLibrarySearchResponse {
  numFound?: number;
  docs?: OpenLibrarySearchDoc[];
}

export type OpenLibraryDescriptionField = string | { type?: string; value?: string };

export interface OpenLibraryWorkResponse {
  description?: OpenLibraryDescriptionField;
  subjects?: string[];
  subtitle?: string;
  covers?: number[];
}
