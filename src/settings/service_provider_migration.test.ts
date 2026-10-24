import { ServiceProvider } from '@src/constants';
import type { BookSearchPluginSettings } from './settings';
import { migrateGoogleServiceProviderToOpenLibrary } from './service_provider_migration';

function minimalSettings(serviceProvider: ServiceProvider): BookSearchPluginSettings {
  return { serviceProvider } as BookSearchPluginSettings;
}

describe('migrateGoogleServiceProviderToOpenLibrary', () => {
  it('migrates google to openlibrary', () => {
    const settings = minimalSettings(ServiceProvider.google);
    expect(migrateGoogleServiceProviderToOpenLibrary(settings)).toBe(true);
    expect(settings.serviceProvider).toBe(ServiceProvider.openlibrary);
  });

  it('leaves openlibrary and naver unchanged', () => {
    const ol = minimalSettings(ServiceProvider.openlibrary);
    expect(migrateGoogleServiceProviderToOpenLibrary(ol)).toBe(false);

    const naver = minimalSettings(ServiceProvider.naver);
    expect(migrateGoogleServiceProviderToOpenLibrary(naver)).toBe(false);
  });
});
