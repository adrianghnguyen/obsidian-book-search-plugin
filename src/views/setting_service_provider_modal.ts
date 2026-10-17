import { ServiceProvider } from '@src/constants';
import BookSearchPlugin from '@src/main';
import { addSecretLinkSetting } from '@settings/secret_link';
import { linkedSecretLabel, resolveSecretId, SECRET_IDS } from '@settings/secrets';
import { Modal, Notice, Setting } from 'obsidian';

export class SettingServiceProviderModal extends Modal {
  private readonly plugin: BookSearchPlugin;
  private readonly currentServiceProvider: ServiceProvider;

  constructor(
    plugin: BookSearchPlugin,
    private callback?: () => void,
  ) {
    super(plugin.app);
    this.plugin = plugin;
    this.currentServiceProvider = plugin.settings?.serviceProvider ?? ServiceProvider.google;
  }

  get settings() {
    return this.plugin.settings;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Service Provider Setting' });
    contentEl.createDiv({
      text: 'Link Naver credentials from Obsidian Secret Storage (OS keychain). Synced data.json stores only the secret ids.',
    });

    const clientIdSecretId = resolveSecretId(this.settings.naverClientIdSecretId, SECRET_IDS.naverClientId);
    const clientSecretSecretId = resolveSecretId(this.settings.naverClientSecretSecretId, SECRET_IDS.naverClientSecret);
    const clientIdLength = this.settings.naverClientId?.length ?? 0;
    const clientSecretLength = this.settings.naverClientSecret?.length ?? 0;

    contentEl.createDiv({
      cls: 'book-search-plugin__secret-status',
      attr: { 'data-secret-status': clientIdLength > 0 ? 'configured' : 'empty' },
      text: `Client ID: ${linkedSecretLabel(clientIdSecretId, clientIdLength)}`,
    });
    contentEl.createDiv({
      cls: 'book-search-plugin__secret-status',
      attr: { 'data-secret-status': clientSecretLength > 0 ? 'configured' : 'empty' },
      text: `Client Secret: ${linkedSecretLabel(clientSecretSecretId, clientSecretLength)}`,
    });

    addSecretLinkSetting(this.app, contentEl, {
      name: 'Client ID',
      desc: 'Link an existing OS key or create a new one. Default id: obsidian-book-search-naver-client-id.',
      secretId: clientIdSecretId,
      onChange: async secretId => {
        this.plugin.settings.naverClientIdSecretId = secretId || SECRET_IDS.naverClientId;
        await this.plugin.hydrateSecrets();
        await this.plugin.saveSettings();
      },
    });

    addSecretLinkSetting(this.app, contentEl, {
      name: 'Client Secret',
      desc: 'Link an existing OS key or create a new one. Default id: obsidian-book-search-naver-client-secret.',
      secretId: clientSecretSecretId,
      onChange: async secretId => {
        this.plugin.settings.naverClientSecretSecretId = secretId || SECRET_IDS.naverClientSecret;
        await this.plugin.hydrateSecrets();
        await this.plugin.saveSettings();
      },
    });

    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText('Done')
        .setCta()
        .onClick(() => {
          if (this.currentServiceProvider !== ServiceProvider.naver) {
            this.close();
            this.callback?.();
            return;
          }
          new Notice('Naver secret links saved.');
          this.close();
          this.callback?.();
        }),
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}
