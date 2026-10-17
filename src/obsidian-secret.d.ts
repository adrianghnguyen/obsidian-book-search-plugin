import type { App } from 'obsidian';

declare module 'obsidian' {
  export class SecretComponent {
    constructor(app: App, containerEl: HTMLElement);
    setValue(value: string): this;
    onChange(callback: (value: string) => unknown): this;
  }

  interface Setting {
    addComponent<T>(cb: (el: HTMLElement) => T): this;
  }
}
