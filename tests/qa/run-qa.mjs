import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const reportDir = resolve(root, 'test-results/qa');
rmSync(reportDir, { recursive: true, force: true });
mkdirSync(reportDir, { recursive: true });

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, QA_REPORT_DIR: reportDir, ...extraEnv },
  });
  if (result.error) console.error(`QA runner command failed to start: ${command}`);
  return result.error ? 1 : (result.status ?? 1);
}

const vitest = run('npm.cmd', ['run', 'test:qa:report', '-w', '@campusconnection/backend']);
const playwright = run('npx.cmd', ['playwright', 'test', '--config=playwright.qa.config.ts']);
const performance = run('node', ['tests/performance/health-smoke.mjs']);
const hasDatabaseEnvironment = Boolean(
  process.env.QA_MONGO_URI && process.env.QA_MONGO_DB_NAME && process.env.QA_REDIS_URL,
);
const database = hasDatabaseEnvironment
  ? run('npm.cmd', ['run', 'test:qa:database:report', '-w', '@campusconnection/backend'])
  : null;

writeFileSync(
  resolve(reportDir, 'execution.json'),
  JSON.stringify({ vitest, playwright, performance, database, hasDatabaseEnvironment }, null, 2),
);

const report = run('node', ['tests/qa/generate-report.mjs']);
process.exitCode = report || 0;
