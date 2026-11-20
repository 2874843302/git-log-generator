import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { splitLogsByWorkload, prepareAllocationLogs, getLogWorkload, findRepeatedWorkItems } from '../frontend/src/lib/logAllocation.js';

const require = createRequire(import.meta.url);
const log = (id, weight, completedAt = `2026-11-${String(id + 1).padStart(2, '0')}T10:00:00+08:00`) => ({
  hash: String(id), repoName: '项目A', message: String.fromCharCode(65 + id).repeat(weight),
  date: '2026-01-01T00:00:00Z', completedAt
});
const score = groups => groups.reduce((sum, group) => sum + group.logs.reduce((w, entry) => w + getLogWorkload(entry), 0) ** 2, 0);
function optimal(weights, days) {
  if (days === 1) return weights.reduce((a, b) => a + b, 0) ** 2;
  let best = Infinity;
  for (let cut = 1; cut <= weights.length - days + 1; cut += 1) {
    best = Math.min(best, weights.slice(0, cut).reduce((a, b) => a + b, 0) ** 2 + optimal(weights.slice(cut), days - 1));
  }
  return best;
}

// Compare with exhaustive partitions, including skewed workload where greedy fails.
let seed = 42;
for (let trial = 0; trial < 200; trial += 1) {
  const n = 2 + trial % 8;
  const days = 1 + trial % n;
  const weights = Array.from({ length: n }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return 1 + seed % 30;
  });
  const logs = weights.map((weight, id) => log(id, weight));
  const dates = Array.from({ length: days }, (_, i) => `202611${String(i + 1).padStart(2, '0')}`);
  const groups = splitLogsByWorkload([...logs].reverse(), [...dates].reverse());
  assert.equal(score(groups), optimal(weights, days));
  assert.deepEqual(groups.flatMap(group => group.logs), logs);
  assert.ok(groups.every(group => group.logs.length));
}
const records = [log(0, 10), log(1, 10), { ...log(2, 10), message: log(0, 10).message }];
assert.deepEqual(prepareAllocationLogs([...records, records[1]]).map(entry => entry.hash), ['1', '2']);
assert.equal(prepareAllocationLogs([records[0], { ...records[0], repoName: '项目B' }]).length, 2);
assert.equal(prepareAllocationLogs([records[0], { ...records[0], hash: 'different', body: '不同阶段的真实变更' }]).length, 2);
assert.equal(getLogWorkload({ ...records[0], diffStat: '100000 insertions(+)' }), 10);
assert.equal(splitLogsByWorkload([], ['20261101']).length, 1);
assert.equal(splitLogsByWorkload(records, []).length, 0);
assert.equal(splitLogsByWorkload([records[0]], ['20261101', '20261102', '20261101']).flatMap(group => group.logs).length, 1);
assert.throws(() => splitLogsByWorkload([{ date: 'invalid' }], ['20261101']), /完成时间/);
const first = '1\\. 项目A: 已完成--8h\n\n功能优化: 完善用户登录权限校验逻辑';
assert.equal(findRepeatedWorkItems('1. 项目A: 已完成--8h\n\n问题处理: 完善用户登录权限校验逻辑。', [first]).length, 1);
assert.equal(findRepeatedWorkItems(first.replace('项目A', '项目B'), [first]).length, 0);
assert.equal(findRepeatedWorkItems(`${first}\n\n功能优化: 完善用户登录权限校验逻辑`, []).length, 1);
console.log('PASS: global balance, chronology, lossless partition, deduplication, sparse dates and repeated output');

// Real Git: author time differs from committer time; completion metadata must survive the service.
const fixture = mkdtempSync(path.join(tmpdir(), 'allocation-git-'));
try {
  execFileSync('git', ['init', '--quiet', fixture]);
  execFileSync('git', ['-C', fixture, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    'commit', '--quiet', '--allow-empty', '-m', '任务正文', '-m', '任务细节'], {
    env: { ...process.env, GIT_AUTHOR_DATE: '2026-11-01T08:00:00+08:00', GIT_COMMITTER_DATE: '2026-11-03T10:00:00+08:00' }
  });
  const entries = await require('../backend/server/services/gitService.js').getGitLogs(fixture);
  assert.equal(entries.length, 1);
  assert.match(entries[0].date, /^2026-11-01/);
  assert.match(entries[0].completedAt, /^2026-11-03/);
  assert.equal(entries[0].body.trim(), '任务细节');
  assert.equal(entries[0].parents, '');
  const baseBranch = execFileSync('git', ['-C', fixture, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
  const git = args => execFileSync('git', ['-C', fixture, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args]);
  git(['checkout', '--quiet', '-b', 'feature']);
  git(['commit', '--quiet', '--allow-empty', '-m', '实现新功能']);
  git(['checkout', '--quiet', baseBranch]);
  git(['commit', '--quiet', '--allow-empty', '-m', '普通开发变更']);
  git(['merge', '--quiet', '--no-ff', 'feature', '-m', '自定义合并标题']);
  const merged = await require('../backend/server/services/gitService.js').getGitLogs(fixture);
  const { isMergeCommit } = await import('../frontend/src/lib/logSelection.js');
  const merge = merged.find(entry => entry.message === '自定义合并标题');
  assert.equal(merge.parents.split(' ').length, 2);
  assert.equal(isMergeCommit(merge), true);
  assert.equal(merged.filter(isMergeCommit).length, 1);
  console.log('PASS: Git completion time and task body');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

// Capture requests locally; no model call or external write.
const originalFetch = globalThis.fetch;
let request;
globalThis.fetch = async (_url, options) => {
  request = JSON.parse(options.body);
  return { ok: true, json: async () => ({ choices: [{ message: { content: first } }] }) };
};
try {
  const { generateAILog } = require('../backend/server/services/aiService.js');
  const params = { logs: [{ ...records[0], body: '仅本日实现的权限校验细节' }], apiKey: 'fixture', templateKey: 'daily', options: {
    includeTomorrow: false, allocationContext: { targetDate: '2026-11-10',
      previousContents: [{ date: '2026-11-09', content: '前一天的已完成任务' }],
      otherDayTasks: [{ date: '20261111', tasks: [{ message: '其他日期专属任务' }] }]
    }
  } };
  await generateAILog(params);
  const prompt = request.messages.at(-1).content;
  for (const text of ['2026-11-10', '前一天的已完成任务', '其他日期专属任务', '不得自动补写', '仅本日实现的权限校验细节']) assert.ok(prompt.includes(text));
  await generateAILog({ ...params, options: {} });
  assert.ok(!request.messages.at(-1).content.includes('多日平均分配约束'));
  console.log('PASS: batch date, task details and cross-day generation constraints; normal generation preserved');
} finally {
  globalThis.fetch = originalFetch;
}
