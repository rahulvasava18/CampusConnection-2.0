import { describe, expect, it } from 'vitest';
import {
  HttpEmailService,
} from '../../src/modules/identity/infrastructure/email.service';

const input = {
  to: 'student@example.com',
  displayName: 'Campus Student',
  token: 'verification-token',
};

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
    const { service } = serviceWithResponse(400);

    await expect(service.sendVerificationEmail(input)).rejects.toMatchObject({
      retryable: false,
      message: 'Email provider rejected the message.',
    });
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
