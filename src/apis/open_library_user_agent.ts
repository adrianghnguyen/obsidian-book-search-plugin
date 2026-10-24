/** Default contact for Open Library identified-client rate limits (3× vs anonymous). */
export const DEFAULT_OPEN_LIBRARY_CONTACT_EMAIL = 'tilounguyen@gmail.com';

export function buildOpenLibraryUserAgent(contactEmail?: string, pluginVersion?: string): string {
  const email = contactEmail?.trim() || DEFAULT_OPEN_LIBRARY_CONTACT_EMAIL;
  const version = pluginVersion?.trim() || '0.0.0';
  return `ObsidianBookSearchPlugin/${version} (${email})`;
}
