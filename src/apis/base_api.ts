import { Book } from '@models/book.model';
import { BookSearchPluginSettings } from '@settings/settings';
import { ServiceProvider } from '@src/constants';
import { requestUrl } from 'obsidian';
import { GoogleBooksApi } from './google_books_api';
import { NaverBooksApi } from './naver_books_api';

export interface BaseBooksApiImpl {
  getByQuery(query: string, options?: Record<string, string>): Promise<Book[]>;
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function factoryServiceProvider(settings: BookSearchPluginSettings): BaseBooksApiImpl {
  switch (settings.serviceProvider) {
    case ServiceProvider.google:
      return new GoogleBooksApi(settings.localePreference, settings.enableCoverImageEdgeCurl, settings.apiKey);
    case ServiceProvider.naver:
      validateNaverSettings(settings);
      return new NaverBooksApi(settings.naverClientId, settings.naverClientSecret);
    default:
      throw new Error('Unsupported service provider.');
  }
}

function validateNaverSettings(settings: BookSearchPluginSettings): void {
  if (!settings.naverClientId || !settings.naverClientSecret) {
    throw new ConfigurationError('네이버 개발자센터에서 "Client ID"와 "Client Secret"를 발급받아 설정해주세요.');
  }
}

export interface ApiHttpResponse<T = unknown> {
  status: number;
  bodyText: string;
  data: T | null;
  headers: Record<string, string>;
}

function readResponseBody(res: Awaited<ReturnType<typeof requestUrl>>): { bodyText: string; data: unknown } {
  const data = res.json as unknown;
  const text = res.text;
  const bodyText =
    typeof text === 'string' && text.length > 0
      ? text
      : data === undefined || data === null
        ? ''
        : JSON.stringify(data);
  return { bodyText, data };
}

export async function apiGetHttp<T>(
  url: string,
  params: Record<string, string | number> = {},
  headers?: Record<string, string>,
): Promise<ApiHttpResponse<T>> {
  const apiURL = new URL(url);
  appendQueryParams(apiURL, params);

  const res = await requestUrl({
    url: apiURL.href,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });

  const { bodyText, data } = readResponseBody(res);
  return { status: res.status, bodyText, data: data as T | null, headers: res.headers ?? {} };
}

export async function apiGet<T>(
  url: string,
  params: Record<string, string | number> = {},
  headers?: Record<string, string>,
): Promise<T> {
  const response = await apiGetHttp<T>(url, params, headers);
  return response.data as T;
}

function appendQueryParams(url: URL, params: Record<string, string | number>): void {
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value.toString());
  });
}
