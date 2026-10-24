import { ServiceProvider } from '@src/constants';
import { BookSearchPluginSettings } from './settings';

/** Legacy global provider: Google-only search is replaced by Open Library + keyed fallback. */
export function migrateGoogleServiceProviderToOpenLibrary(settings: BookSearchPluginSettings): boolean {
  if (settings.serviceProvider === ServiceProvider.google) {
    settings.serviceProvider = ServiceProvider.openlibrary;
    return true;
  }
  return false;
}
