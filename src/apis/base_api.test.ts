import type { BookSearchPluginSettings } from '@settings/settings';
import { ServiceProvider } from '@src/constants';
import { factoryServiceProvider } from './base_api';
import { OpenLibraryRouteApi } from './open_library_route_api';

function settingsWithProvider(serviceProvider: ServiceProvider): BookSearchPluginSettings {
  return {
    serviceProvider,
    openLibraryContactEmail: '',
    supplementWithGoogleBooks: false,
    localePreference: 'default',
    enableCoverImageEdgeCurl: true,
    apiKey: '',
    naverClientId: '',
    naverClientSecret: '',
  } as BookSearchPluginSettings;
}

describe('factoryServiceProvider', () => {
  it('returns OpenLibraryRouteApi for openlibrary', () => {
    const provider = factoryServiceProvider(settingsWithProvider(ServiceProvider.openlibrary), '1.0.0');
    expect(provider).toBeInstanceOf(OpenLibraryRouteApi);
  });

  it('treats legacy google enum as the same Open Library route stack', () => {
    const provider = factoryServiceProvider(settingsWithProvider(ServiceProvider.google), '1.0.0');
    expect(provider).toBeInstanceOf(OpenLibraryRouteApi);
  });
});
