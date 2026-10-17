import type { App } from 'obsidian';

export interface BookSearchSecretFields {
  apiKey: string;
  naverClientId: string;
  naverClientSecret: string;
}

export const SECRET_IDS = {
  googleApiKey: 'obsidian-book-search-api-key',
  naverClientId: 'obsidian-book-search-naver-client-id',
  naverClientSecret: 'obsidian-book-search-naver-client-secret',
} as const;

/** Cursor Cloud env names → secretStorage ids (see `.cloud-e2e/secret-bindings.json`). */
export const EXPECTED_CURSOR_ENV = {
  googleApiKey: 'book_search_gcp',
  googleApiKeyAlias: 'GOOGLE_BOOKS_API_KEY',
  naverClientId: 'NAVER_CLIENT_ID',
  naverClientSecret: 'NAVER_CLIENT_SECRET',
} as const;

export interface SecretStore {
  get(id: string): Promise<string>;
  set(id: string, value: string): Promise<void>;
  delete(id: string): Promise<void>;
}

type SecretStorageLike = {
  get?: (id: string) => Promise<string | null> | string | null;
  set?: (id: string, value: string) => Promise<void> | void;
  delete?: (id: string) => Promise<void> | void;
  getSecret?: (id: string) => Promise<string | null> | string | null;
  setSecret?: (id: string, value: string) => Promise<void> | void;
  deleteSecret?: (id: string, value?: string) => Promise<void> | void;
};
