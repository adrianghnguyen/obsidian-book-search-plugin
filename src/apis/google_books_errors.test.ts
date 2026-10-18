import { parseGoogleBooksErrorBody, userMessageForGoogleBooksError } from './google_books_errors';

describe('google books errors', () => {
  it('parses API_KEY_INVALID on 400', () => {
    const body = JSON.stringify({
      error: {
        code: 400,
        message: 'API key not valid.',
        errors: [{ reason: 'badRequest' }],
        details: [{ reason: 'API_KEY_INVALID' }],
      },
    });
    const parsed = parseGoogleBooksErrorBody(400, body);
    const msg = userMessageForGoogleBooksError(parsed, 'api_key');
    expect(msg).toContain('Your API key:');
    expect(msg).toMatch(/valid/i);
  });

  it('maps anonymous 429 shared pool', () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        errors: [{ reason: 'rateLimitExceeded' }],
        details: [
          {
            reason: 'RATE_LIMIT_EXCEEDED',
            metadata: {
              quota_limit: 'defaultPerDayPerProject',
              quota_limit_value: '0',
              consumer: 'projects/624717413613',
            },
          },
        ],
      },
    });
    const parsed = parseGoogleBooksErrorBody(429, body);
    const msg = userMessageForGoogleBooksError(parsed, 'anonymous_pool');
    expect(msg).toContain('Shared anonymous pool:');
    expect(msg).toMatch(/API key/i);
  });

  it('maps keyed per-minute quota', () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        errors: [{ reason: 'rateLimitExceeded' }],
        details: [
          {
            reason: 'RATE_LIMIT_EXCEEDED',
            metadata: { quota_limit: 'defaultPerMinutePerUser', consumer: 'projects/12345' },
          },
        ],
      },
    });
    const parsed = parseGoogleBooksErrorBody(429, body);
    const msg = userMessageForGoogleBooksError(parsed, 'api_key');
    expect(msg).toContain('Your API key:');
    expect(msg).toMatch(/100\/min/i);
  });

  it('maps unregistered 403', () => {
    const body = JSON.stringify({
      error: {
        code: 403,
        errors: [{ reason: 'userRateLimitExceededUnreg' }],
      },
    });
    const parsed = parseGoogleBooksErrorBody(403, body);
    const msg = userMessageForGoogleBooksError(parsed, 'anonymous_pool');
    expect(msg).toContain('Shared anonymous pool:');
  });
});
