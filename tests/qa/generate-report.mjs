import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scenarios } from './scenarios.mjs';

const reportDir = resolve(process.env.QA_REPORT_DIR ?? 'test-results/qa');
const readJson = (name, fallback) => {
  const path = resolve(reportDir, name);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
};

function vitestResults() {
  const report = readJson('vitest.json', { testResults: [] });
  return (report.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? []).map((test) => ({
      source: 'vitest',
      name: test.fullName ?? test.title ?? '',
      status: test.status === 'passed' ? 'PASS' : test.status === 'failed' ? 'FAIL' : 'BLOCKED',
      error: (test.failureMessages ?? []).join(' ').replace(/\s+/g, ' ').trim(),
    })),
  );
}

function playwrightResults() {
  const report = readJson('playwright.json', { suites: [] });
  const results = [];
  const walk = (suite, parents = []) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const failed = test.status === 'unexpected' || test.status === 'flaky';
        const skipped = test.status === 'skipped';
        const errors = (test.results ?? [])
          .flatMap((result) => result.errors ?? [])
          .map((error) => error.message ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        results.push({
          source: 'playwright',
          name: [...parents, suite.title, spec.title].filter(Boolean).join(' > '),
          status: failed ? 'FAIL' : skipped ? 'BLOCKED' : 'PASS',
          error: errors,
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...parents, suite.title].filter(Boolean));
  };
  for (const suite of report.suites ?? []) walk(suite);
  return results;
}

function performanceResults() {
  const result = readJson('performance.json', undefined);
  if (!result) return [];
  return [
    {
      source: 'performance',
      name: 'health-smoke',
      status: result.failures === 0 ? 'PASS' : 'FAIL',
      error: result.failures === 0 ? '' : `${result.failures} health requests failed`,
      result,
    },
  ];
}

const executions = [...vitestResults(), ...playwrightResults(), ...performanceResults()];
const qaEnvironmentReady = Boolean(
  process.env.QA_MONGO_URI && process.env.QA_MONGO_DB_NAME && process.env.QA_REDIS_URL,
);
const execution = readJson('execution.json', {});

function resolveScenario(item) {
  if (item.source === 'manual') {
    return { status: 'MANUAL', actual: 'Not automated by policy.' };
  }
  if (item.source === 'blocked-qa-environment') {
    return {
      status: 'BLOCKED',
      actual: qaEnvironmentReady
        ? 'Authenticated workflow automation is not configured in this QA run.'
        : 'Dedicated QA MongoDB, Redis, and authenticated QA configuration are unavailable.',
    };
  }
  const matches = executions.filter(
    (result) => result.source === item.source && result.name.includes(item.matcher),
  );
  if (matches.some((result) => result.status === 'FAIL')) {
    const failure = matches.find((result) => result.status === 'FAIL');
    return {
      status: 'FAIL',
      actual: failure.error || 'Automated result did not match expected behavior.',
    };
  }
  if (matches.some((result) => result.status === 'PASS')) {
    const pass = matches.find((result) => result.status === 'PASS');
    if (pass.result) {
      return {
        status: 'PASS',
        actual: `Health smoke passed (${pass.result.samples} requests; p95 ${pass.result.p95Ms}ms).`,
      };
    }
    return { status: 'PASS', actual: 'Automated result matched expected behavior.' };
  }
  return { status: 'BLOCKED', actual: 'No result was emitted by the configured QA runner.' };
}

const scenarioResults = scenarios.map((item) => ({
  feature: item.feature,
  scenario: item.scenario,
  expected: item.expected,
  ...resolveScenario(item),
}));

const features = {};
for (const result of scenarioResults) {
  const summary = (features[result.feature] ??= {
    health: 'HEALTHY',
    pass: 0,
    fail: 0,
    partial: 0,
    manual: 0,
    blocked: 0,
  });
  summary[result.status.toLowerCase()] += 1;
}
for (const summary of Object.values(features)) {
  if (summary.fail > 0) summary.health = 'FAIL';
  else if (summary.blocked > 0) summary.health = 'BLOCKED';
  else if (summary.pass === 0 && summary.manual > 0) summary.health = 'MANUAL';
  else if (summary.partial > 0) summary.health = 'PARTIAL';
  else summary.health = 'HEALTHY';
}

const hasFailures = scenarioResults.some((result) => result.status === 'FAIL');
const hasBlocked = scenarioResults.some((result) => result.status === 'BLOCKED');
const hasPartial = Object.values(features).some((feature) => feature.health === 'PARTIAL');
const overallStatus = hasFailures
  ? 'FAIL'
  : hasBlocked
    ? 'BLOCKED'
    : hasPartial
      ? 'PARTIAL'
      : 'HEALTHY';
const generatedAt = new Date().toISOString();
const actionRequired = scenarioResults.filter((result) =>
  ['FAIL', 'PARTIAL', 'BLOCKED'].includes(result.status),
);
const manualScenarios = scenarioResults.filter((result) => result.status === 'MANUAL');

const report = {
  overallStatus,
  generatedAt,
  features,
  scenarios: scenarioResults,
  actionRequired,
  manualScenarios,
  execution,
};
writeFileSync(resolve(reportDir, 'qa-report.json'), JSON.stringify(report, null, 2));
writeFileSync(
  resolve(reportDir, 'feature-health.json'),
  JSON.stringify({ overallStatus, generatedAt, features }, null, 2),
);

const icon = {
  HEALTHY: '🟢 HEALTHY',
  FAIL: '🔴 FAIL',
  PARTIAL: '🟡 PARTIAL',
  MANUAL: '⚪ MANUAL',
  BLOCKED: '⏸️ BLOCKED',
};
const lines = [
  '# CampusConnection QA report',
  '',
  `Generated: ${generatedAt}`,
  `Overall status: **${icon[overallStatus]}**`,
  '',
  '## Feature health summary',
  '',
  '| Feature | Health | Pass | Fail | Partial | Manual | Blocked |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
  ...Object.entries(features).map(
    ([feature, value]) =>
      `| ${feature} | ${icon[value.health]} | ${value.pass} | ${value.fail} | ${value.partial} | ${value.manual} | ${value.blocked} |`,
  ),
  '',
  '## Detailed scenario results',
  '',
  '| Feature | Scenario | Expected | Actual | Status |',
  '| --- | --- | --- | --- | --- |',
  ...scenarioResults.map(
    (result) =>
      `| ${result.feature} | ${result.scenario} | ${result.expected} | ${result.actual} | ${result.status} |`,
  ),
  '',
  '## Action required',
  '',
  ...(actionRequired.length
    ? actionRequired.flatMap((result) => [
        `### ${result.status === 'FAIL' ? '🔴' : result.status === 'BLOCKED' ? '⏸️' : '🟡'} ${result.feature} — ${result.scenario}`,
        `- Expected: ${result.expected}`,
        `- Actual: ${result.actual}`,
        `- Status: ${result.status}`,
        '',
      ])
    : ['No action required.', '']),
  '## Manual scenarios',
  '',
  ...(manualScenarios.length
    ? manualScenarios.map(
        (result) => `- ${result.feature} — ${result.scenario}: ${result.expected}`,
      )
    : ['None.']),
  '',
  '## Execution summary',
  '',
  `- Vitest exit code: ${execution.vitest ?? 'not recorded'}`,
  `- Playwright exit code: ${execution.playwright ?? 'not recorded'}`,
  `- Performance exit code: ${execution.performance ?? 'not recorded'}`,
  `- Database exit code: ${execution.database ?? 'not run'}`,
];
writeFileSync(resolve(reportDir, 'qa-report.md'), `${lines.join('\n')}\n`);

console.log('');
console.log('==================================================');
console.log('CAMPUSCONNECTION QA');
console.log('==================================================');
for (const [feature, value] of Object.entries(features))
  console.log(`${icon[value.health].padEnd(14)} ${feature}`);
console.log('');
console.log('--------------------------------------------------');
console.log(`Overall: ${icon[overallStatus]}`);
console.log('--------------------------------------------------');
console.log(
  `Failures requiring attention: ${scenarioResults.filter((result) => result.status === 'FAIL').length}`,
);
console.log(`Blocked: ${scenarioResults.filter((result) => result.status === 'BLOCKED').length}`);
console.log(`Manual: ${manualScenarios.length}`);
console.log('');
console.log('Full report:');
console.log('test-results/qa/qa-report.md');

if (overallStatus === 'FAIL') process.exitCode = 1;
else if (overallStatus === 'BLOCKED') process.exitCode = 2;
