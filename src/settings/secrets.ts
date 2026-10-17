import type { App } from 'obsidian';

export interface BookSearchSecretFields {
  apiKey: string;
  naverClientId: string;
  naverClientSecret: string;
}

/** Synced `data.json` pointers — secret *ids*, never secret values. */
export interface BookSearchSecretPointers {
  apiKeySecretId: string;
  naverClientIdSecretId: string;
  naverClientSecretSecretId: string;
}

export const SECRET_IDS = {
  googleApiKey: 'obsidian-book-search-api-key',
  naverClientId: 'obsidian-book-search-naver-client-id',
  naverClientSecret: 'obsidian-book-search-naver-client-secret',
} as const;

export const DEFAULT_SECRET_POINTERS: BookSearchSecretPointers = {
  apiKeySecretId: SECRET_IDS.googleApiKey,
  naverClientIdSecretId: SECRET_IDS.naverClientId,
  naverClientSecretSecretId: SECRET_IDS.naverClientSecret,
};

/** Cursor Cloud env names → secretStorage ids (see `.cloud-e2e/secret-bindings.json`). */
export const EXPECTED_CURSOR_ENV = {
  googleApiKey: 'GOOGLE_BOOKS_API_KEY',
  googleApiKeyAlias: 'book_search_gcp',
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
  deleteSecret?: (id: string) => Promise<void> | void;
};

export function configuredSecretLabel(length: number): string {
  return length > 0 ? `Configured (OS keychain, ${length} characters)` : 'Not configured';
}

export function linkedSecretLabel(secretId: string, length: number): string {
  const id = secretId.trim() || '(none)';
  return `${configuredSecretLabel(length)} · linked as ${id}`;
}

export function resolveSecretId(pointer: string | undefined, fallbackId: string): string {
  const trimmed = pointer?.trim() ?? '';
  return trimmed || fallbackId;
}

export async function readLinkedSecret(
  store: SecretStore,
  pointer: string | undefined,
  fallbackId: string,
): Promise<string> {
  const id = resolveSecretId(pointer, fallbackId);
  const primary = await store.get(id);
  if (primary) {
    return primary;
  }
  if (id !== fallbackId) {
    return store.get(fallbackId);
  }
  return '';
}

export function stripSecretsFromSettings<T extends BookSearchSecretFields>(settings: T): T {
  return {
    ...settings,
    apiKey: '',
    naverClientId: '',
    naverClientSecret: '',
  };
}

export function createSecretStore(app: App): SecretStore {
  const storage = (app as App & { secretStorage?: SecretStorageLike }).secretStorage;
  if (!storage) {
    throw new Error('Obsidian secretStorage is unavailable. Update Obsidian to store API keys in the OS keychain.');
  }

  return {
    async get(id: string): Promise<string> {
      if (typeof storage.get === 'function') {
        return (await storage.get(id)) ?? '';
      }
      if (typeof storage.getSecret === 'function') {
        return (await Promise.resolve(storage.getSecret(id))) ?? '';
      }
      return '';
    },
    async set(id: string, value: string): Promise<void> {
      if (typeof storage.set === 'function') {
        await storage.set(id, value);
        return;
      }
      if (typeof storage.setSecret === 'function') {
        await Promise.resolve(storage.setSecret(id, value));
      }
    },
    async delete(id: string): Promise<void> {
      if (typeof storage.delete === 'function') {
        await storage.delete(id);
        return;
      }
      if (typeof storage.deleteSecret === 'function') {
        await Promise.resolve(storage.deleteSecret(id));
      }
    },
  };
}

export async function persistSecretIfProvided(
  store: SecretStore,
  id: string,
  value: string,
): Promise<'saved' | 'unchanged'> {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'unchanged';
  }
  await store.set(id, trimmed);
  return 'saved';
}

export async function clearSecret(store: SecretStore, id: string): Promise<void> {
  await store.delete(id);
}

export async function hydrateSecrets(
  store: SecretStore,
  settings: BookSearchSecretFields & Partial<BookSearchSecretPointers>,
): Promise<void> {
  settings.apiKey = await readLinkedSecret(store, settings.apiKeySecretId, SECRET_IDS.googleApiKey);
  settings.naverClientId = await readLinkedSecret(store, settings.naverClientIdSecretId, SECRET_IDS.naverClientId);
  settings.naverClientSecret = await readLinkedSecret(
    store,
    settings.naverClientSecretSecretId,
    SECRET_IDS.naverClientSecret,
  );
}

export async function migrateLegacySecrets(
  store: SecretStore,
  loaded: Partial<BookSearchSecretFields> | undefined,
): Promise<boolean> {
  if (!loaded) {
    return false;
  }

  let migrated = false;
  const pairs: Array<[keyof BookSearchSecretFields, string]> = [
    ['apiKey', SECRET_IDS.googleApiKey],
    ['naverClientId', SECRET_IDS.naverClientId],
    ['naverClientSecret', SECRET_IDS.naverClientSecret],
  ];

  for (const [field, id] of pairs) {
    const value = typeof loaded[field] === 'string' ? String(loaded[field]).trim() : '';
    if (!value) {
      continue;
    }
    const existing = await store.get(id);
    if (!existing) {
      await store.set(id, value);
    }
    migrated = true;
  }

  return migrated;
}

export function createMemorySecretStore(initial: Record<string, string> = {}): SecretStore {
  const map = new Map(Object.entries(initial));
  return {
    async get(id: string): Promise<string> {
      return map.get(id) ?? '';
    },
    async set(id: string, value: string): Promise<void> {
      map.set(id, value);
    },
    async delete(id: string): Promise<void> {
      map.delete(id);
    },
  };
}
