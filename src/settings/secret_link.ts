import { App, SecretComponent, Setting } from 'obsidian';

/**
 * Native Obsidian secret picker (create or link an existing OS key).
 * The setting stores the secret *id*, not the secret value.
 */
export function addSecretLinkSetting(
  app: App,
  containerEl: HTMLElement,
  options: {
    name: string;
    desc: string;
    secretId: string;
    onChange: (secretId: string) => Promise<void>;
  },
): Setting {
  return new Setting(containerEl)
    .setName(options.name)
    .setDesc(options.desc)
    .addComponent(el =>
      new SecretComponent(app, el).setValue(options.secretId).onChange(async value => {
        await options.onChange((value ?? '').trim());
      }),
    );
}
