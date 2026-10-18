import * as obsidian from 'obsidian';

export const requestUrl: typeof obsidian.requestUrl = (request: string | obsidian.RequestUrlParam) => {
  const url = typeof request === 'string' ? request : request.url;
  return fetch(url).then(res => ({
    status: res.status,
    json: res.json.bind(res),
    text: res.text.bind(res),
    arrayBuffer: res.arrayBuffer.bind(res),
    headers: {},
  })) as obsidian.RequestUrlResponsePromise;
};

export function setIcon(el: HTMLElement, icon: string): void {
  el.setAttr('data-icon', icon);
}

export function setTooltip(el: HTMLElement, tooltip: string, _options?: unknown): void {
  el.setAttr('data-tooltip', tooltip);
}
