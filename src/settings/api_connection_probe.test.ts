import { googleBooksRequestGate } from '@apis/google_books_request_gate';
import {
  mapGoogleBooksConnectionResult,
  mapHttpStatusToConnectionResult,
  probeGoogleBooksConnection,
  probeNaverBooksConnection,
  type ConnectionHttpRequest,
} from './api_connection_probe';

describe('api connection probe', () => {
  beforeEach(() => {
    googleBooksRequestGate.resetForTests();
  });
  const mockRequest =
    (status: number): ConnectionHttpRequest =>
    async () => ({ status });

  const throwingRequest: ConnectionHttpRequest = async () => {
    throw new Error('network down');
  };

  it('maps HTTP 200 to connected', () => {
    expect(mapHttpStatusToConnectionResult(200).outcome).toBe('connected');
  });

  it('maps HTTP 400 and 403 to key rejected', () => {
    expect(mapHttpStatusToConnectionResult(400).outcome).toBe('key_rejected');
    expect(mapHttpStatusToConnectionResult(403).outcome).toBe('key_rejected');
  });

  it('maps HTTP 429 to quota exceeded', () => {
    expect(mapHttpStatusToConnectionResult(429).outcome).toBe('quota_exceeded');
  });

  it('maps other HTTP codes to unknown_error', () => {
    expect(mapHttpStatusToConnectionResult(500).outcome).toBe('unknown_error');
  });

  it('probes anonymous route when Google key is empty', async () => {
    let capturedUrl = '';
    const request: ConnectionHttpRequest = async url => {
      capturedUrl = url;
      return { status: 200 };
    };
    const result = await probeGoogleBooksConnection('  ', request);
    expect(result.outcome).toBe('connected');
    expect(result.authRoute).toBe('anonymous_pool');
    expect(capturedUrl).not.toContain('key=');
    expect(result.detail).toContain('Shared anonymous pool');
  });

  it('probes Google Books with a minimal volumes URL', async () => {
    let capturedUrl = '';
    const request: ConnectionHttpRequest = async url => {
      capturedUrl = url;
      return { status: 200 };
    };

    const result = await probeGoogleBooksConnection('test-key', request);

    expect(result.outcome).toBe('connected');
    expect(capturedUrl).toContain('googleapis.com/books/v1/volumes');
    expect(capturedUrl).toContain('q=connection-test');
    expect(capturedUrl).toContain('maxResults=1');
    expect(decodeURIComponent(capturedUrl)).toContain('key=test-key');
  });

  it('maps keyed Google HTTP 403 to key rejected with route detail', async () => {
    const body = JSON.stringify({ error: { errors: [{ reason: 'keyInvalid' }] } });
    const request: ConnectionHttpRequest = async () => ({ status: 403, bodyText: body });
    const result = await probeGoogleBooksConnection('bad', request);
    expect(result.outcome).toBe('key_rejected');
    expect(result.detail).toContain('Your API key:');
  });

  it('maps Google HTTP 429 to quota exceeded with route detail', async () => {
    const body = JSON.stringify({
      error: {
        errors: [{ reason: 'rateLimitExceeded' }],
        details: [{ metadata: { quota_limit: 'defaultPerMinutePerUser' } }],
      },
    });
    const request: ConnectionHttpRequest = async () => ({ status: 429, bodyText: body });
    const result = await probeGoogleBooksConnection('key', request);
    expect(result.outcome).toBe('quota_exceeded');
    expect(result.detail).toContain('Your API key:');
  });

  it('mapGoogleBooksConnectionResult distinguishes connected routes', () => {
    const keyed = mapGoogleBooksConnectionResult(200, '', 'api_key');
    expect(keyed.detail).toContain('Your API key');
    const anon = mapGoogleBooksConnectionResult(200, '', 'anonymous_pool');
    expect(anon.detail).toContain('Shared anonymous pool');
  });

  it('maps Google network errors', async () => {
    const result = await probeGoogleBooksConnection('key', throwingRequest);
    expect(result.outcome).toBe('network_error');
  });

  it('returns not configured when Naver credentials are incomplete', async () => {
    expect((await probeNaverBooksConnection('', 'sec', mockRequest(200))).outcome).toBe('not_configured');
    expect((await probeNaverBooksConnection('id', '', mockRequest(200))).outcome).toBe('not_configured');
  });

  it('probes Naver with search headers', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> | undefined;
    const request: ConnectionHttpRequest = async (url, headers) => {
      capturedUrl = url;
      capturedHeaders = headers;
      return { status: 200 };
    };

    const result = await probeNaverBooksConnection('naver-id', 'naver-secret', request);

    expect(result.outcome).toBe('connected');
    expect(capturedUrl).toContain('openapi.naver.com/v1/search/book.json');
    expect(capturedUrl).toContain('query=connection-test');
    expect(capturedHeaders?.['X-Naver-Client-Id']).toBe('naver-id');
    expect(capturedHeaders?.['X-Naver-Client-Secret']).toBe('naver-secret');
  });

  it('maps Naver HTTP 400 to key rejected', async () => {
    const result = await probeNaverBooksConnection('id', 'sec', mockRequest(400));
    expect(result.outcome).toBe('key_rejected');
  });

  it('maps Naver network errors', async () => {
    const result = await probeNaverBooksConnection('id', 'sec', throwingRequest);
    expect(result.outcome).toBe('network_error');
  });
});
