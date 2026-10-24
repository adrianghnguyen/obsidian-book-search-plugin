import { BaseBooksApiImpl, factoryServiceProvider } from '@apis/base_api';
import { resolveGoogleBooksAuthRoute } from '@apis/google_books_auth';
import { googleBooksRequestGate } from '@apis/google_books_request_gate';
import { GoogleBooksThrottleError } from '@apis/google_books_throttle';
import { Book } from '@models/book.model';
import { DEFAULT_SETTINGS } from '@settings/settings';
import { ServiceProvider } from '@src/constants';
import BookSearchPlugin from '@src/main';
import languages from '@utils/languages';
import { ButtonComponent, Modal, Notice, Setting, TextComponent } from 'obsidian';
import { applySearchProviderPill, BookSearchLegId, SearchProviderPillPhase } from './search_provider_pill';

export class BookSearchModal extends Modal {
  private readonly SEARCH_BUTTON_TEXT = 'Search';
  private readonly REQUESTING_BUTTON_TEXT = 'Requesting...';
  private isBusy = false;
  private okBtnRef?: ButtonComponent;
  private serviceProvider: BaseBooksApiImpl;
  private options: { locale: string };
  private cooldownEl?: HTMLElement;
  private unsubscribeCooldown?: () => void;
  private providerPillEl?: HTMLElement;
  private lastSearchLeg?: BookSearchLegId;

  constructor(
    private plugin: BookSearchPlugin,
    private query: string,
    private callback: (error: Error | null, result?: Book[]) => void,
  ) {
    super(plugin.app);
    this.options = { locale: plugin.settings.localePreference };
    this.serviceProvider = factoryServiceProvider(plugin.settings, plugin.manifest.version);
  }

  /** Reload keychain secrets and rebuild the search client (key must be on the wire). */
  private async refreshSearchProvider(): Promise<void> {
    await this.plugin.hydrateSecrets();
    this.serviceProvider = factoryServiceProvider(this.plugin.settings, this.plugin.manifest.version);
  }

  setBusy(busy: boolean): void {
    this.isBusy = busy;
    const cooldownActive = this.isGoogleCooldownActive();
    this.okBtnRef
      ?.setDisabled(busy || cooldownActive)
      .setButtonText(busy ? this.REQUESTING_BUTTON_TEXT : this.SEARCH_BUTTON_TEXT);
  }

  private defaultSearchLeg(): BookSearchLegId {
    return this.plugin.settings.serviceProvider === ServiceProvider.naver ? 'naver' : 'open_library';
  }

  private isGoogleProvider(): boolean {
    return this.plugin.settings.serviceProvider === ServiceProvider.google;
  }

  private googleAuthRoute() {
    return resolveGoogleBooksAuthRoute(this.plugin.settings.apiKey);
  }

  private isGoogleCooldownActive(): boolean {
    return this.isGoogleProvider() && googleBooksRequestGate.isInCooldown();
  }

  private paintProviderPill(phase: SearchProviderPillPhase, leg?: BookSearchLegId): void {
    if (!this.providerPillEl) {
      return;
    }
    applySearchProviderPill(this.providerPillEl, phase, leg, this.plugin.settings);
  }

  private paintGoogleCooldown(): void {
    if (!this.cooldownEl || !this.isGoogleProvider()) {
      return;
    }
    const line = googleBooksRequestGate.statusLine(this.googleAuthRoute());
    if (line) {
      this.cooldownEl.setText(line);
      this.cooldownEl.addClass('book-search-plugin__google-cooldown--active');
    } else {
      this.cooldownEl.setText('');
      this.cooldownEl.removeClass('book-search-plugin__google-cooldown--active');
    }
    this.setBusy(this.isBusy);
  }

  async searchBook(): Promise<void> {
    if (!this.query) return void new Notice('No query entered.');
    if (this.isBusy) return;
    if (this.isGoogleCooldownActive()) {
      const line = googleBooksRequestGate.statusLine(this.googleAuthRoute());
      if (line) new Notice(line);
      return;
    }

    this.setBusy(true);
    this.lastSearchLeg = undefined;
    this.paintProviderPill('searching', this.defaultSearchLeg());
    try {
      await this.refreshSearchProvider();
      const searchResults = await this.serviceProvider.getByQuery(this.query, this.options, {
        onLegStart: leg => {
          this.lastSearchLeg = leg;
          this.paintProviderPill('searching', leg);
        },
      });
      if (!searchResults?.length) {
        this.paintProviderPill('done', this.lastSearchLeg ?? this.defaultSearchLeg());
        return void new Notice(`No results found for "${this.query}"`);
      }
      this.paintProviderPill('done', this.lastSearchLeg ?? this.defaultSearchLeg());
      this.callback(null, searchResults);
      this.close();
    } catch (err) {
      if (err instanceof GoogleBooksThrottleError) {
        this.paintGoogleCooldown();
        new Notice(err.message);
        return;
      }
      this.paintProviderPill('error', this.lastSearchLeg ?? this.defaultSearchLeg());
      this.callback(err as Error);
      this.close();
    } finally {
      this.setBusy(false);
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Search Book' });
    this.providerPillEl = contentEl.createDiv({ cls: 'book-search-plugin__search-provider-pill' });
    this.paintProviderPill('idle');
    if (this.plugin.settings.serviceProvider !== ServiceProvider.naver && this.plugin.settings.askForLocale) {
      this.renderSelectLocale();
    }
    contentEl.createDiv({ cls: 'book-search-plugin__search-modal--input' }, el => {
      new TextComponent(el)
        .setValue(this.query)
        .setPlaceholder('Search by keyword or ISBN')
        .onChange(value => (this.query = value))
        .inputEl.addEventListener('keydown', event => event.key === 'Enter' && !event.isComposing && this.searchBook());
    });
    if (this.isGoogleProvider()) {
      this.cooldownEl = contentEl.createDiv({ cls: 'book-search-plugin__google-cooldown' });
      this.unsubscribeCooldown = googleBooksRequestGate.subscribe(() => this.paintGoogleCooldown());
      void this.refreshSearchProvider().then(() => this.paintGoogleCooldown());
    }
    new Setting(this.contentEl).addButton(btn => {
      this.okBtnRef = btn
        .setButtonText(this.SEARCH_BUTTON_TEXT)
        .setCta()
        .onClick(() => this.searchBook());
    });
  }

  renderSelectLocale() {
    const defaultLocale = window.moment.locale();
    new Setting(this.contentEl).setName('Locale').addDropdown(dropdown => {
      dropdown.addOption(defaultLocale, `${languages[defaultLocale] || defaultLocale}`);
      window.moment.locales().forEach(locale => {
        const localeName = languages[locale];
        if (localeName && locale !== defaultLocale) dropdown.addOption(locale, localeName);
      });
      dropdown
        .setValue(this.options.locale === DEFAULT_SETTINGS.localePreference ? defaultLocale : this.options.locale)
        .onChange(locale => (this.options.locale = locale));
    });
  }

  onClose(): void {
    this.unsubscribeCooldown?.();
    this.unsubscribeCooldown = undefined;
    const { contentEl } = this;
    contentEl.empty();
  }
}
