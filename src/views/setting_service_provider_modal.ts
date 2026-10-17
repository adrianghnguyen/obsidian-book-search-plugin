import { ServiceProvider } from '@src/constants';
import BookSearchPlugin from '@src/main';
import { clearSecret, configuredSecretLabel, persistSecretIfProvided, SECRET_IDS } from '@settings/secrets';
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
      text: 'Naver credentials are stored in the OS keychain, not in synced data.json.',
    });

    const clientIdLength = this.settings.naverClientId?.length ?? 0;
    const clientSecretLength = this.settings.naverClientSecret?.length ?? 0;

    contentEl.createDiv({
      cls: 'book-search-plugin__secret-status',
      attr: { 'data-secret-status': clientIdLength > 0 ? 'configured' : 'empty' },
      text: `Client ID: ${configuredSecretLabel(clientIdLength)}`,
    });
    contentEl.createDiv({
      cls: 'book-search-plugin__secret-status',
      attr: { 'data-secret-status': clientSecretLength > 0 ? 'configured' : 'empty' },
      text: `Client Secret: ${configuredSecretLabel(clientSecretLength)}`,
    });

    let tempClientId = '';
    let tempClientSecret = '';

    new Setting(contentEl)
      .setName('Client ID')
      .setDesc('Leave blank and Save to keep the existing value. Use Clear to delete.')
      .addText(text => {
        text.inputEl.type = 'password';
        text.inputEl.setAttribute('autocomplete', 'off');
        text.setPlaceholder(clientIdLength > 0 ? '••••••••' : 'Paste Client ID');
        text.setValue('').onChange(value => {
          tempClientId = value;
        });
      });

    new Setting(contentEl)
      .setName('Client Secret')
      .setDesc('Leave blank and Save to keep the existing value. Use Clear to delete.')
      .addText(text => {
        text.inputEl.type = 'password';
        text.inputEl.setAttribute('autocomplete', 'off');
        text.setPlaceholder(clientSecretLength > 0 ? '••••••••' : 'Paste Client Secret');
        text.setValue('').onChange(value => {
          tempClientSecret = value;
        });
      });

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText('Save')
          .setCta()
          .onClick(async () => {
            if (this.currentServiceProvider !== ServiceProvider.naver) {
              this.close();
              this.callback?.();
              return;
            }
            const store = this.plugin.getSecretStore();
            const idResult = await persistSecretIfProvided(store, SECRET_IDS.naverClientId, tempClientId);
            const secretResult = await persistSecretIfProvided(store, SECRET_IDS.naverClientSecret, tempClientSecret);
            if (idResult === 'saved') {
              this.plugin.settings.naverClientId = tempClientId.trim();
            }
            if (secretResult === 'saved') {
              this.plugin.settings.naverClientSecret = tempClientSecret.trim();
            }
            await this.plugin.saveSettings();
            if (idResult === 'unchanged' && secretResult === 'unchanged') {
              new Notice('Left empty — existing Naver credentials kept.');
            } else {
              new Notice('Naver credentials saved to OS keychain.');
            }
            this.close();
            this.callback?.();
          }),
      )
      .addButton(btn =>
        btn
          .setButtonText('Clear')
          .setWarning()
          .onClick(async () => {
            const store = this.plugin.getSecretStore();
            await clearSecret(store, SECRET_IDS.naverClientId);
            await clearSecret(store, SECRET_IDS.naverClientSecret);
            this.plugin.settings.naverClientId = '';
            this.plugin.settings.naverClientSecret = '';
            await this.plugin.saveSettings();
            new Notice('Naver credentials cleared from OS keychain.');
            this.close();
            this.callback?.();
          }),
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}
