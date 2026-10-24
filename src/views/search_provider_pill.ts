import { BookSearchPluginSettings } from '@settings/settings';
import { ServiceProvider } from '@src/constants';

/** Active HTTP leg during a search (for modal pill). */
export type BookSearchLegId = 'open_library' | 'google_books_fallback' | 'google_books_supplement' | 'naver';

export type SearchProviderPillPhase = 'idle' | 'searching' | 'done' | 'error';

export function labelForSearchLeg(leg: BookSearchLegId): string {
  switch (leg) {
    case 'open_library':
      return 'Open Library';
    case 'google_books_fallback':
      return 'Google Books';
    case 'google_books_supplement':
      return 'Google Books';
    case 'naver':
      return 'Naver';
    default:
      return 'Search';
  }
}

export function detailForSearchLeg(leg: BookSearchLegId): string | undefined {
  switch (leg) {
    case 'google_books_fallback':
      return 'fallback';
    case 'google_books_supplement':
      return 'supplement';
    default:
      return undefined;
  }
}

export function idlePillPrimaryLabel(settings: Pick<BookSearchPluginSettings, 'serviceProvider'>): string {
  if (settings.serviceProvider === ServiceProvider.naver) {
    return 'Naver';
  }
  return 'Open Library';
}

export function idlePillSecondaryLabel(
  settings: Pick<BookSearchPluginSettings, 'serviceProvider' | 'apiKey' | 'supplementWithGoogleBooks'>,
): string | undefined {
  if (settings.serviceProvider === ServiceProvider.naver) {
    return undefined;
  }
  const hasKey = Boolean(settings.apiKey?.trim());
  if (settings.supplementWithGoogleBooks && hasKey) {
    return 'Google supplement when linked';
  }
  if (hasKey) {
    return 'Google fallback if no matches';
  }
  return 'Open Library only';
}

export function searchingPillText(leg: BookSearchLegId): { primary: string; secondary?: string } {
  const detail = detailForSearchLeg(leg);
  return {
    primary: `Searching… ${labelForSearchLeg(leg)}`,
    secondary: detail,
  };
}

export function applySearchProviderPill(
  el: HTMLElement,
  phase: SearchProviderPillPhase,
  leg?: BookSearchLegId,
  idleSettings?: Pick<BookSearchPluginSettings, 'serviceProvider' | 'apiKey' | 'supplementWithGoogleBooks'>,
): void {
  el.empty();
  el.removeAttribute('data-phase');
  el.removeAttribute('data-leg');

  const pill = el.createDiv({ cls: 'book-search-plugin__search-provider-pill-inner' });

  if (phase === 'idle' && idleSettings) {
    el.setAttr('data-phase', 'idle');
    pill.createSpan({
      cls: 'book-search-plugin__search-provider-pill-label',
      text: idlePillPrimaryLabel(idleSettings),
    });
    const secondary = idlePillSecondaryLabel(idleSettings);
    if (secondary) {
      pill.createSpan({ cls: 'book-search-plugin__search-provider-pill-detail', text: secondary });
    }
    return;
  }

  if (phase === 'searching' && leg) {
    el.setAttr('data-phase', 'searching');
    el.setAttr('data-leg', leg);
    const { primary, secondary } = searchingPillText(leg);
    pill.createSpan({ cls: 'book-search-plugin__search-provider-pill-label', text: primary });
    if (secondary) {
      pill.createSpan({ cls: 'book-search-plugin__search-provider-pill-detail', text: secondary });
    }
    return;
  }

  if ((phase === 'done' || phase === 'error') && leg) {
    el.setAttr('data-phase', phase);
    el.setAttr('data-leg', leg);
    const prefix = phase === 'error' ? 'Failed on' : 'Via';
    pill.createSpan({
      cls: 'book-search-plugin__search-provider-pill-label',
      text: `${prefix} ${labelForSearchLeg(leg)}`,
    });
    const secondary = detailForSearchLeg(leg);
    if (secondary) {
      pill.createSpan({ cls: 'book-search-plugin__search-provider-pill-detail', text: secondary });
    }
  }
}
