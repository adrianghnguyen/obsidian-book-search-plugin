import { ServiceProvider } from '@src/constants';
import {
  detailForSearchLeg,
  idlePillPrimaryLabel,
  idlePillSecondaryLabel,
  labelForSearchLeg,
  searchingPillText,
} from './search_provider_pill';

describe('search_provider_pill helpers', () => {
  it('labels search legs', () => {
    expect(labelForSearchLeg('open_library')).toBe('Open Library');
    expect(labelForSearchLeg('google_books_fallback')).toBe('Google Books');
    expect(detailForSearchLeg('google_books_fallback')).toBe('fallback');
  });

  it('idle label for global route', () => {
    expect(idlePillPrimaryLabel({ serviceProvider: ServiceProvider.openlibrary })).toBe('Open Library');
    expect(
      idlePillSecondaryLabel({
        serviceProvider: ServiceProvider.openlibrary,
        apiKey: 'k',
        supplementWithGoogleBooks: false,
      }),
    ).toBe('Google fallback if no matches');
  });

  it('searching text includes leg name', () => {
    expect(searchingPillText('open_library').primary).toContain('Open Library');
    expect(searchingPillText('google_books_fallback').secondary).toBe('fallback');
  });
});
