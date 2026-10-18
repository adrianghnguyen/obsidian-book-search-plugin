import * as obsidian from 'obsidian';

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
