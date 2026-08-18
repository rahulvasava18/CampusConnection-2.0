import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { startWorkerHealthServer } from '../../src/processes/worker-runtime';

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
  server = undefined;
});

describe('worker health server', () => {
  it('does not start without a configured port', async () => {
    await expect(startWorkerHealthServer(undefined)).resolves.toBeUndefined();
  });

  it('serves GET and HEAD health checks without exposing application routes', async () => {
    const activeServer = await startWorkerHealthServer(0);
    server = activeServer;
    if (!activeServer) throw new Error('Health server did not start.');
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Health server did not bind.');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const getResponse = await fetch(`${baseUrl}/health`);
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual({
      status: 'ok',
      service: 'CampusConnection worker',
    });

    const headResponse = await fetch(`${baseUrl}/health`, { method: 'HEAD' });
    expect(headResponse.status).toBe(200);
    expect(await headResponse.text()).toBe('');

    const applicationResponse = await fetch(`${baseUrl}/api/health`);
    expect(applicationResponse.status).toBe(404);
  });
});
