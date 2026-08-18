import { startApi } from './processes/api';
import { startRealtime } from './processes/realtime';

const processName = process.argv[2] ?? 'api';

const starters = {
  api: startApi,
  realtime: startRealtime,
} as const;

const start = starters[processName as keyof typeof starters];
if (!start) {
  throw new Error(`Unknown process: ${processName}. Expected api or realtime.`);
}

void start();
