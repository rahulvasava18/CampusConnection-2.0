import { startApi } from './processes/api';
import { startRealtime } from './processes/realtime';
import { startWorker } from './processes/worker';

const processName = process.argv[2] ?? 'api';

const starters = {
  api: startApi,
  realtime: startRealtime,
  worker: startWorker,
} as const;

const start = starters[processName as keyof typeof starters];
if (!start) {
  throw new Error(`Unknown process: ${processName}. Expected api, realtime, or worker.`);
}

void start();
