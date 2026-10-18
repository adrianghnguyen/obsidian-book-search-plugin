import { authRoutePrefix, GOOGLE_BOOKS_ANONYMOUS_CONSUMER_HINT, type GoogleBooksAuthRoute } from './google_books_auth';

export interface ParsedGoogleBooksError {
  httpStatus: number;
  legacyReason?: string;
  errorInfoReason?: string;
  quotaLimit?: string;
  consumer?: string;
  message?: string;
}

export class GoogleBooksApiError extends Error {
  readonly authRoute: GoogleBooksAuthRoute;
  readonly httpStatus: number;

  constructor(message: string, authRoute: GoogleBooksAuthRoute, httpStatus: number) {
    super(message);
    this.name = 'GoogleBooksApiError';
    this.authRoute = authRoute;
    this.httpStatus = httpStatus;
  }
}

export function parseGoogleBooksErrorBody(httpStatus: number, bodyText: string): ParsedGoogleBooksError {
  const parsed: ParsedGoogleBooksError = { httpStatus };
  if (!bodyText?.trim()) {
    return parsed;
  }
  try {
    const body = JSON.parse(bodyText) as {
      error?: {
        message?: string;
        errors?: Array<{ reason?: string; domain?: string }>;
        status?: string;
        details?: Array<{
          reason?: string;
          metadata?: Record<string, string>;
        }>;
      };
    };
    parsed.message = body.error?.message;
    parsed.legacyReason = body.error?.errors?.[0]?.reason;
    const errorInfo = body.error?.details?.find(d => d.reason || d.metadata);
    parsed.errorInfoReason = errorInfo?.reason;
    const metadata = errorInfo?.metadata ?? {};
    parsed.quotaLimit = metadata.quota_limit;
    parsed.consumer = metadata.consumer;
  } catch {
    // non-JSON body
  }
  return parsed;
}

function isAnonymousConsumer(parsed: ParsedGoogleBooksError): boolean {
  if (parsed.consumer?.includes(GOOGLE_BOOKS_ANONYMOUS_CONSUMER_HINT)) {
    return true;
  }
  const unreg = parsed.legacyReason ?? '';
  return /Unreg$/i.test(unreg);
}

function isUnregisteredReason(parsed: ParsedGoogleBooksError): boolean {
  const reason = parsed.legacyReason ?? parsed.errorInfoReason ?? '';
  return /Unreg$/i.test(reason) || reason === 'dailyLimitExceededUnreg';
}

export function userMessageForGoogleBooksError(
  parsed: ParsedGoogleBooksError,
  authRoute: GoogleBooksAuthRoute,
): string {
  const prefix = authRoutePrefix(authRoute);
  const reason = parsed.legacyReason ?? parsed.errorInfoReason ?? '';

  if (authRoute === 'anonymous_pool' || isAnonymousConsumer(parsed) || isUnregisteredReason(parsed)) {
    if (parsed.httpStatus === 429 || reason.includes('LimitExceeded') || parsed.quotaLimit) {
      return `${prefix} shared quota or rate limit hit. Add your own Google Books API key in Settings.`;
    }
    if (parsed.httpStatus === 403) {
      return `${prefix} Google blocked anonymous use. Add your own API key (enable Books API on your Cloud project).`;
    }
    return `${prefix} request failed (HTTP ${parsed.httpStatus}). Add your own API key for reliable search.`;
  }

  if (parsed.httpStatus === 400 || reason === 'keyInvalid' || reason === 'API_KEY_INVALID') {
    return `${prefix} rejected — check the linked secret is a valid Books API key.`;
  }
  if (reason === 'accessNotConfigured') {
    return `${prefix} Books API is not enabled for this key’s Google Cloud project. Enable it in Cloud Console.`;
  }
  if (reason === 'ipRefererBlocked') {
    return `${prefix} key restrictions blocked this app (IP/referrer). Use a desktop-friendly key without HTTP referrer lock.`;
  }
  if (parsed.httpStatus === 429 || parsed.quotaLimit === 'defaultPerMinutePerUser') {
    return `${prefix} too many requests (~100/min per user). Wait a minute and try again.`;
  }
  if (parsed.httpStatus === 429 || parsed.quotaLimit === 'defaultPerDayPerProject') {
    return `${prefix} daily quota reached for this Cloud project. Try again after reset or request a quota increase.`;
  }
  if (parsed.httpStatus === 429) {
    return `${prefix} quota or rate limit exceeded (HTTP 429). Wait and retry.`;
  }
  if (parsed.httpStatus === 403) {
    return `${prefix} access denied (HTTP 403). Check key, API enablement, and restrictions.`;
  }
  if (parsed.httpStatus >= 400) {
    return `${prefix} request failed (HTTP ${parsed.httpStatus}).`;
  }
  return `${prefix} request failed.`;
}

export function connectionDetailForGoogleBooksError(
  parsed: ParsedGoogleBooksError,
  authRoute: GoogleBooksAuthRoute,
): string {
  return userMessageForGoogleBooksError(parsed, authRoute);
}
