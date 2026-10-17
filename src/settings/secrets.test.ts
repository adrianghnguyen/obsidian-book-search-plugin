import {
  SECRET_IDS,
  clearSecret,
  configuredSecretLabel,
  createMemorySecretStore,
  hydrateSecrets,
  migrateLegacySecrets,
  persistSecretIfProvided,
  stripSecretsFromSettings,
  type BookSearchSecretFields,
} from './secrets';

const secretFields = (overrides: Partial<BookSearchSecretFields> = {}): BookSearchSecretFields => ({
  apiKey: '',
  naverClientId: '',
  naverClientSecret: '',
  ...overrides,
});

describe('secretStorage helpers', () => {
  it('strips API keys from the synced settings payload', () => {
    const synced = stripSecretsFromSettings({
      ...secretFields({
        apiKey: 'google-secret',
        naverClientId: 'naver-id',
        naverClientSecret: 'naver-secret',
      }),
      folder: 'Books',
    });

    expect(synced.apiKey).toBe('');
    expect(synced.naverClientId).toBe('');
    expect(synced.naverClientSecret).toBe('');
    expect(synced.folder).toBe('Books');
  });

  it('does not delete an existing secret when the password field is empty', async () => {
    const store = createMemorySecretStore({ [SECRET_IDS.googleApiKey]: 'kept-key' });

    const result = await persistSecretIfProvided(store, SECRET_IDS.googleApiKey, '   ');

    expect(result).toBe('unchanged');
    expect(await store.get(SECRET_IDS.googleApiKey)).toBe('kept-key');
  });

  it('saves a non-empty value to the keychain', async () => {
    const store = createMemorySecretStore();

    const result = await persistSecretIfProvided(store, SECRET_IDS.googleApiKey, ' new-key ');

    expect(result).toBe('saved');
    expect(await store.get(SECRET_IDS.googleApiKey)).toBe('new-key');
  });

  it('clears a secret only on explicit delete', async () => {
    const store = createMemorySecretStore({ [SECRET_IDS.googleApiKey]: 'kept-key' });

    await clearSecret(store, SECRET_IDS.googleApiKey);

    expect(await store.get(SECRET_IDS.googleApiKey)).toBe('');
  });

  it('hydrates runtime settings from secret ids', async () => {
    const store = createMemorySecretStore({
      [SECRET_IDS.googleApiKey]: 'g',
      [SECRET_IDS.naverClientId]: 'id',
      [SECRET_IDS.naverClientSecret]: 'sec',
    });
    const settings = secretFields();

    await hydrateSecrets(store, settings);

    expect(settings.apiKey).toBe('g');
    expect(settings.naverClientId).toBe('id');
    expect(settings.naverClientSecret).toBe('sec');
  });

  it('migrates leftover data.json keys into the keychain once', async () => {
    const store = createMemorySecretStore();

    const migrated = await migrateLegacySecrets(store, {
      apiKey: 'legacy-google',
      naverClientId: 'legacy-id',
      naverClientSecret: 'legacy-secret',
    });

    expect(migrated).toBe(true);
    expect(await store.get(SECRET_IDS.googleApiKey)).toBe('legacy-google');
    expect(await store.get(SECRET_IDS.naverClientId)).toBe('legacy-id');
    expect(await store.get(SECRET_IDS.naverClientSecret)).toBe('legacy-secret');
  });

  it('does not overwrite a keychain value during legacy migration', async () => {
    const store = createMemorySecretStore({ [SECRET_IDS.googleApiKey]: 'keychain-wins' });

    await migrateLegacySecrets(store, { apiKey: 'legacy-google' });

    expect(await store.get(SECRET_IDS.googleApiKey)).toBe('keychain-wins');
  });

  it('shows a masked configured status without the secret value', () => {
    expect(configuredSecretLabel(12)).toBe('Configured (OS keychain, 12 characters)');
    expect(configuredSecretLabel(0)).toBe('Not configured');
    expect(configuredSecretLabel(12)).not.toContain('sk-');
  });
});
