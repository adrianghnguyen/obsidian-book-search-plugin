import { connectionDetailForGoogleBooksError, parseGoogleBooksErrorBody } from '@apis/google_books_errors';
import { authRoutePrefix, resolveGoogleBooksAuthRoute, type GoogleBooksAuthRoute } from '@apis/google_books_auth';
import { requestUrl } from 'obsidian';

export type ApiConnectionOutcome =
  | 'not_configured'
  | 'checking'
  | 'connected'
  | 'key_rejected'
  | 'quota_exceeded'
  | 'network_error'
  | 'unknown_error';

export interface ApiConnectionResult {
  outcome: ApiConnectionOutcome;
  httpStatus?: number;
  /** Longer hint for (i) tooltip — never includes secret material. */
  detail: string;
  authRoute?: GoogleBooksAuthRoute;
}

export type ConnectionHttpRequest = (
  url: string,
  headers?: Record<string, string>,
) => Promise<{ status: number; bodyText?: string }>;

const GOOGLE_PROBE_URL = 'https://www.googleapis.com/books/v1/volumes';
const NAVER_PROBE_URL = 'https://openapi.naver.com/v1/search/book.json';

export function apiConnectionStatusLine(outcome: ApiConnectionOutcome): string {
  switch (outcome) {
    case 'not_configured':
      return 'Not configured';
    case 'checking':
      return 'Checking…';
    case 'connected':
      return 'Connected';
    case 'key_rejected':
      return 'Key rejected';
    case 'quota_exceeded':
      return 'Quota exceeded';
    case 'network_error':
      return 'Could not reach API';
    case 'unknown_error':
      return 'Connection failed';
    default:
      return 'Connection failed';
  }
}

export function mapHttpStatusToConnectionResult(status: number): ApiConnectionResult {
  if (status === 200) {
    return {
      outcome: 'connected',
      httpStatus: status,
      detail: 'The API accepted your credentials and returned a successful response.',
    };
  }
  if (status === 400 || status === 403) {
    return {
      outcome: 'key_rejected',
      httpStatus: status,
      detail: `The provider rejected the request (HTTP ${status}). Check that the linked secret is valid for this API.`,
    };
  }
  if (status === 429) {
    return {
      outcome: 'quota_exceeded',
      httpStatus: status,
      detail: 'The provider reported rate or quota limits (HTTP 429). Wait and try again, or review your API plan.',
    };
  }
  return {
    outcome: 'unknown_error',
    httpStatus: status,
    detail: `Unexpected HTTP ${status}. The endpoint responded but the connection check did not succeed.`,
  };
}

export function mapGoogleBooksConnectionResult(
  status: number,
  bodyText: string | undefined,
  authRoute: GoogleBooksAuthRoute,
): ApiConnectionResult {
  if (status === 200) {
    const routeLabel = authRoute === 'api_key' ? 'Your API key' : 'Shared anonymous pool';
    return {
      outcome: 'connected',
      httpStatus: status,
      authRoute,
      detail: `${routeLabel}: Google Books responded successfully on this route.`,
    };
  }

  const parsed = parseGoogleBooksErrorBody(status, bodyText ?? '');
  const detail = connectionDetailForGoogleBooksError(parsed, authRoute);
  let outcome: ApiConnectionOutcome = 'unknown_error';

  if (authRoute === 'anonymous_pool' && (status === 429 || status === 403)) {
    outcome = 'quota_exceeded';
  } else if (status === 400 || (status === 403 && parsed.legacyReason !== 'accessNotConfigured')) {
    outcome = authRoute === 'api_key' ? 'key_rejected' : 'quota_exceeded';
  } else if (status === 403 && parsed.legacyReason === 'accessNotConfigured') {
    outcome = 'key_rejected';
  } else if (status === 429) {
    outcome = 'quota_exceeded';
  }

  return { outcome, httpStatus: status, detail, authRoute };
}

export function notConfiguredConnectionResult(detail: string): ApiConnectionResult {
  return { outcome: 'not_configured', detail };
}

async function defaultConnectionRequest(
  url: string,
  headers?: Record<string, string>,
): Promise<{ status: number; bodyText?: string }> {
  const res = await requestUrl({
    url,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });
  const bodyText =
    typeof res.text === 'string' && res.text.length > 0
      ? res.text
      : res.json === undefined || res.json === null
        ? ''
        : JSON.stringify(res.json);
  return { status: res.status, bodyText };
}

export async function probeGoogleBooksConnection(
  apiKey: string,
  httpRequest: ConnectionHttpRequest = defaultConnectionRequest,
): Promise<ApiConnectionResult> {
  const trimmed = apiKey.trim();
  const authRoute = resolveGoogleBooksAuthRoute(trimmed);

  const url = new URL(GOOGLE_PROBE_URL);
  url.searchParams.set('q', 'connection-test');
  url.searchParams.set('maxResults', '1');
  if (trimmed) {
    url.searchParams.set('key', trimmed);
  }

  try {
    const { status, bodyText } = await httpRequest(url.href);
    return mapGoogleBooksConnectionResult(status, bodyText, authRoute);
  } catch {
    return {
      outcome: 'network_error',
      authRoute,
      detail: `${authRoutePrefix(authRoute)} could not reach Google Books. Check network, firewall, or VPN.`,
    };
  }
}

export async function probeNaverBooksConnection(
  clientId: string,
  clientSecret: string,
  httpRequest: ConnectionHttpRequest = defaultConnectionRequest,
): Promise<ApiConnectionResult> {
  const id = clientId.trim();
  const secret = clientSecret.trim();
  if (!id || !secret) {
    return notConfiguredConnectionResult('Link both Naver Client ID and Client Secret, then run Test connection.');
  }

  const url = new URL(NAVER_PROBE_URL);
  url.searchParams.set('query', 'connection-test');
  url.searchParams.set('display', '1');
  url.searchParams.set('sort', 'sim');

  try {
    return mapHttpStatusToConnectionResult(
      (
        await httpRequest(url.href, {
          'X-Naver-Client-Id': id,
          'X-Naver-Client-Secret': secret,
        })
      ).status,
    );
  } catch {
    return {
      outcome: 'network_error',
      detail: 'Could not reach Naver Open API. Check your network, firewall, or VPN, then try again.',
    };
  }
}
