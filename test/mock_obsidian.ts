import * as obsidian from 'obsidian';

export class Modal {
  contentEl: HTMLElement;

  constructor(public app: obsidian.App) {
    this.contentEl = document.createElement('div');
  }

  open(): void {
    return;
  }

  close(): void {
    return;
  }
}

export class Notice {
  constructor(_message: unknown) {
    return;
  }
}

export class Setting {
  constructor(_container: HTMLElement) {
    return;
  }

  setName(_name: string): this {
    return this;
  }

  setDesc(_desc: string): this {
    return this;
  }

  addButton(
    cb: (button: {
      setButtonText: (t: string) => unknown;
      setCta: () => unknown;
      onClick: (fn: () => void) => unknown;
      buttonEl: HTMLButtonElement;
    }) => unknown,
  ): this {
    const buttonEl = document.createElement('button');
    cb({
      setButtonText: () => ({ setCta: () => ({ onClick: () => ({}) }), buttonEl }),
      setCta: () => ({ onClick: () => ({}) }),
      onClick: () => ({}),
      buttonEl,
    });
    return this;
  }

  addDropdown(_cb: unknown): this {
    return this;
  }
}

export class TextComponent {
  inputEl = document.createElement('input');

  setValue(_value: string): this {
    return this;
  }

  setPlaceholder(_placeholder: string): this {
    return this;
  }

  onChange(_cb: (value: string) => void): this {
    return this;
  }
}

export class ButtonComponent {
  constructor(public buttonEl: HTMLButtonElement) {}

  setDisabled(_disabled: boolean): this {
    return this;
  }

  setButtonText(_text: string): this {
    return this;
  }
}

export const requestUrl: typeof obsidian.requestUrl = (request: string | obsidian.RequestUrlParam) => {
  const url = typeof request === 'string' ? request : request.url;
  return fetch(url).then(async res => {
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      status: res.status,
      json,
      text,
      arrayBuffer: new ArrayBuffer(0),
      headers: {},
    };
  }) as obsidian.RequestUrlResponsePromise;
};

export function setIcon(el: HTMLElement, icon: string): void {
  el.setAttr('data-icon', icon);
}

export function setTooltip(el: HTMLElement, tooltip: string, _options?: unknown): void {
  el.setAttr('data-tooltip', tooltip);
}

interface SearchResult {
  score: number;
  matches: number[][];
}

function foldLatinDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '');
}

function caseInsensitiveSimpleSearch(searchTerm: string, phrase: string): SearchResult | null {
  if (!searchTerm.trim()) {
    return null;
  }

  const searchTerms = searchTerm.split(/\s+/).filter(Boolean);
  const foldedPhrase = foldLatinDiacritics(phrase.toLowerCase());
  const matches: number[][] = [];

  for (const term of searchTerms) {
    const foldedTerm = foldLatinDiacritics(term.toLowerCase());
    const index = foldedPhrase.indexOf(foldedTerm);
    if (index === -1) {
      return null;
    }
    matches.push([index, index + foldedTerm.length]);
  }

  return matches.length > 0 ? { score: 0, matches } : null;
}

/** Test mock aligned with Obsidian prepareSimpleSearch (incl. accent folding on 1.15+). */
export function prepareSimpleSearch(query: string): (text: string) => SearchResult | null {
  return (text: string) => caseInsensitiveSimpleSearch(query, text);
}
