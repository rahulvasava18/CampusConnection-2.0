import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const baseUrl = process.env.QA_TARGET_API_URL ?? 'http://localhost:4000';
const samples = Number(process.env.QA_PERF_SAMPLES ?? 30);
const concurrency = Number(process.env.QA_PERF_CONCURRENCY ?? 5);

if (
  !Number.isInteger(samples) ||
  samples < 1 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1
) {
  throw new Error('QA_PERF_SAMPLES and QA_PERF_CONCURRENCY must be positive integers.');
}

const durations = [];
let completed = 0;
let failures = 0;

async function runSample() {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    if (!response.ok) failures += 1;
  } catch {
    failures += 1;
  } finally {
    durations.push(performance.now() - started);
    completed += 1;
  }
}

while (completed < samples) {
  await Promise.all(
    Array.from({ length: Math.min(concurrency, samples - completed) }, () => runSample()),
  );
}

durations.sort((a, b) => a - b);
const percentile = (fraction) =>
  durations[Math.min(durations.length - 1, Math.ceil(durations.length * fraction) - 1)];
const result = {
  target: baseUrl,
  samples,
  concurrency,
  failures,
  p50Ms: Number(percentile(0.5).toFixed(1)),
  p95Ms: Number(percentile(0.95).toFixed(1)),
  maxMs: Number(Math.max(...durations).toFixed(1)),
};
console.log(JSON.stringify(result));
if (process.env.QA_REPORT_DIR) {
  const outputPath = `${process.env.QA_REPORT_DIR}/performance.json`;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
}
if (failures > 0) process.exitCode = 1;
