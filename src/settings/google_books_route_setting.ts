import { Setting } from 'obsidian';
import { googleBooksAuthRouteLabel, resolveGoogleBooksAuthRoute } from '@apis/google_books_auth';

export function mountGoogleBooksRouteSetting(
  containerEl: HTMLElement,
  getApiKey: () => string,
): { refresh: () => void } {
  const setting = new Setting(containerEl)
    .setName('Google Books search route')
    .setDesc('Shows whether searches use your linked API key or Google’s shared anonymous pool.');
  const routeLine = setting.controlEl.createDiv({
    cls: 'book-search-plugin__google-route-line',
    text: '',
  });

  const paint = (): void => {
    const route = resolveGoogleBooksAuthRoute(getApiKey());
    const copy = googleBooksAuthRouteLabel(route);
    routeLine.setText(copy.settingsLine);
    routeLine.setAttr('data-google-books-route', route);
  };

  paint();

  return { refresh: paint };
}
