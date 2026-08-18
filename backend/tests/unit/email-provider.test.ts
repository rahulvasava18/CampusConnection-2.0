import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HttpEmailService,
} from '../../src/modules/identity/infrastructure/email.service';
import { logger } from '../../src/shared/logging/logger';

const input = {
  to: 'student@example.com',
  displayName: 'Campus Student',
  token: 'verification-token',
};

afterEach(() => {
  vi.restoreAllMocks();
});

function serviceWithResponse(status: number, timeoutMs = 100): {
  service: HttpEmailService;
  requests: Array<{ input: string; init: RequestInit }>;
} {
  const requests: Array<{ input: string; init: RequestInit }> = [];
  const service = new HttpEmailService({
    endpoint: 'https://api.example.test/emails',
    apiKey: 'provider-key',
    from: 'CampusConnection <noreply@example.com>',
    timeoutMs,
    fetchImplementation: async (requestInput, init) => {
      requests.push({ input: String(requestInput), init: init ?? {} });
      return new Response(null, { status });
    },
  });
  return { service, requests };
}

describe('HTTPS email provider', () => {
  it('sends a verification message through the configured provider', async () => {
    const { service, requests } = serviceWithResponse(202);

    await expect(service.sendVerificationEmail(input)).resolves.toBeUndefined();

    expect(requests).toHaveLength(1);
    expect(requests[0]?.input).toBe('https://api.example.test/emails');
    expect(requests[0]?.init?.method).toBe('POST');
    expect(requests[0]?.init?.headers).toMatchObject({
      Authorization: 'Bearer provider-key',
      'Content-Type': 'application/json',
    });
    expect(String(requests[0]?.init?.body)).toContain('verification-token');
  });

  it.each([408, 429, 500, 503])('marks provider status %s as retryable', async (status) => {
    const { service } = serviceWithResponse(status);

    await expect(service.sendVerificationEmail(input)).rejects.toMatchObject({
      retryable: true,
      message: 'Email provider is temporarily unavailable.',
    });
  });

  it('marks provider validation failures as permanent', async () => {
    const errorSpy = vi.spyOn(logger, 'error');
    const service = new HttpEmailService({
      endpoint: 'https://api.example.test/emails',
      apiKey: 'provider-key',
      from: 'CampusConnection <noreply@example.com>',
      timeoutMs: 100,
      fetchImplementation: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'The from address is not verified.',
              name: 'validation_error',
              type: 'invalid_request_error',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
    });

    await expect(
      service.sendVerificationEmail({ ...input, idempotencyKey: 'correlation-400' }),
    ).rejects.toMatchObject({
      retryable: false,
      message: 'Email provider rejected the message.',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      {
        status: 400,
        correlationId: 'correlation-400',
        providerErrorCode: 'validation_error',
        providerErrorMessage: 'The from address is not verified.',
        providerErrorName: 'validation_error',
        providerErrorType: 'invalid_request_error',
      },
      'Email provider rejected the message.',
    );
  });

  it('logs structured details for provider server failures without changing retry behavior', async () => {
    const errorSpy = vi.spyOn(logger, 'error');
    const service = new HttpEmailService({
      endpoint: 'https://api.example.test/emails',
      apiKey: 'provider-key',
      from: 'CampusConnection <noreply@example.com>',
      timeoutMs: 100,
      fetchImplementation: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'internal_error',
              message: 'Provider is temporarily unavailable.',
              name: 'internal_error',
              type: 'provider_error',
            },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
    });

    await expect(
      service.sendVerificationEmail({ ...input, idempotencyKey: 'correlation-503' }),
    ).rejects.toMatchObject({
      retryable: true,
      message: 'Email provider is temporarily unavailable.',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 503,
        correlationId: 'correlation-503',
        providerErrorCode: 'internal_error',
        providerErrorMessage: 'Provider is temporarily unavailable.',
        providerErrorName: 'internal_error',
        providerErrorType: 'provider_error',
      }),
      'Email provider rejected the message.',
    );
  });

  it('handles malformed provider error responses without exposing the response body', async () => {
    const errorSpy = vi.spyOn(logger, 'error');
    const service = new HttpEmailService({
      endpoint: 'https://api.example.test/emails',
      apiKey: 'provider-key',
      from: 'CampusConnection <noreply@example.com>',
      timeoutMs: 100,
      fetchImplementation: async () => new Response('not-json-provider-content', { status: 400 }),
    });

    await expect(
      service.sendVerificationEmail({ ...input, idempotencyKey: 'correlation-malformed' }),
    ).rejects.toMatchObject({
      retryable: false,
      message: 'Email provider rejected the message.',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      { status: 400, correlationId: 'correlation-malformed' },
      'Email provider rejected the message.',
    );
    expect(errorSpy.mock.calls[0]?.[0]).not.toHaveProperty('responseBody');
  });

  it('converts network failures into retryable delivery errors without exposing provider details', async () => {
    const service = new HttpEmailService({
      endpoint: 'https://api.example.test/emails',
      apiKey: 'provider-key',
      from: 'CampusConnection <noreply@example.com>',
      timeoutMs: 100,
      fetchImplementation: async () => {
        throw new Error('provider secret should not escape');
      },
    });

    await expect(service.sendVerificationEmail(input)).rejects.toMatchObject({
      retryable: true,
      message: 'Email provider request failed.',
    });
  });

  it('times out without hanging the worker', async () => {
    const service = new HttpEmailService({
      endpoint: 'https://api.example.test/emails',
      apiKey: 'provider-key',
      from: 'CampusConnection <noreply@example.com>',
      timeoutMs: 5,
      fetchImplementation: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    });

    await expect(service.sendVerificationEmail(input)).rejects.toMatchObject({
      retryable: true,
      message: 'Email provider request failed.',
    });
  });
});
