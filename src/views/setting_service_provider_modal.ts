import { ServiceProvider } from '@src/constants';
import BookSearchPlugin from '@src/main';
import { probeNaverBooksConnection } from '@settings/api_connection_probe';
import { mountApiConnectionUi } from '@settings/api_connection_ui';
import { addSecretLinkSetting } from '@settings/secret_link';
import { resolveSecretId, SECRET_IDS } from '@settings/secrets';
import { Modal, Notice, Setting } from 'obsidian';

export class SettingServiceProviderModal extends Modal {
  private readonly plugin: BookSearchPlugin;
  private readonly currentServiceProvider: ServiceProvider;
  private apiConnectionUi?: ReturnType<typeof mountApiConnectionUi>;

  constructor(
    plugin: BookSearchPlugin,
    private callback?: () => void,
  ) {
    super(plugin.app);
    this.plugin = plugin;
    this.currentServiceProvider = plugin.settings?.serviceProvider ?? ServiceProvider.openlibrary;
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

    addSecretLinkSetting(this.app, contentEl, {
      name: 'Client ID',
      desc: 'Link an existing OS key or create a new one. Default id: obsidian-book-search-naver-client-id.',
      secretId: clientIdSecretId,
      onChange: async secretId => {
        this.plugin.settings.naverClientIdSecretId = secretId || SECRET_IDS.naverClientId;
        await this.plugin.hydrateSecrets();
        await this.plugin.saveSettings();
        this.apiConnectionUi?.refreshConfiguredState();
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
        this.apiConnectionUi?.refreshConfiguredState();
      },
    });

    this.apiConnectionUi = mountApiConnectionUi({
      containerEl: contentEl,
      name: 'Naver API connection',
      desc: 'Live check against Naver Open API using your linked Client ID and Secret.',
      isConfigured: () =>
        (this.settings.naverClientId?.trim().length ?? 0) > 0 &&
        (this.settings.naverClientSecret?.trim().length ?? 0) > 0,
      runProbe: async () => {
        await this.plugin.hydrateSecrets();
        return probeNaverBooksConnection(this.settings.naverClientId, this.settings.naverClientSecret);
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
