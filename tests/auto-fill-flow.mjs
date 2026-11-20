import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { splitLogsByWorkload } from '../frontend/src/lib/logAllocation.js';
import { removeRepeatedWorkItems, rebalanceGeneratedContents } from '../frontend/src/lib/logContent.js';
import { getDefaultIgnoredHashes } from '../frontend/src/lib/logSelection.js';

const require = createRequire(import.meta.url);
// Execute the actual orchestration closure with fixture IPC dependencies, never syncing a real account.
const source = readFileSync(new URL('../frontend/src/App.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('const handleAutoFillLogs = async (mode) => {');
const end = source.indexOf('\n  /**\n   * 傻瓜模式', start);
assert.ok(start >= 0 && end > start);
const closure = source.slice(start, end).replace(/^const handleAutoFillLogs = /, '').trim().replace(/;$/, '');
const dates = ['20261101', '20261102', '20261103', '20261104'];
const logs = dates.map((date, index) => ({
  hash: String(index), repoName: '项目A', message: `独立功能事项${index}开发`, date: `2026-11-0${index + 1}T10:00:00+08:00`
}));
logs.push(...dates.map((date, index) => ({
  hash: `merge-${index}`, repoName: '项目A', message: '自定义合并标题', parents: 'parent-a parent-b',
  date: `2026-11-0${index + 1}T12:00:00+08:00`
})));
const output = text => `1\\. 项目A: 已完成--8h\n\n功能优化: ${text}`;
const duplicateOnly = output('完善用户登录权限校验逻辑');
const first = `${duplicateOnly}\n\n问题处理: 修复用户登录验证码过期问题`;
const second = output('处理课程目录展示顺序错误');
const fourth = output('实现作业附件下载鉴权功能');
const outputs = [first, `${duplicateOnly}\n\n功能优化: 处理课程目录展示顺序错误`, duplicateOnly, duplicateOnly, fourth];
const calls = [];
const synced = [];
const notices = [];
const loadingChanges = [];
const autoFillRunning = { current: false };
let fetchCount = 0;
const context = {
  missingLogDates: dates, selectedMissingDates: [...dates, dates[0]], loading: false,
  fillStartDate: '', fillEndDate: '', repoPaths: ['fixture'], logs: [], defaultUser: '',
  ignoredHashes: new Set(), selectedTemplate: 'daily', templateOptions: {}, autoFillRunning,
  splitLogsByWorkload, removeRepeatedWorkItems, rebalanceGeneratedContents, getDefaultIgnoredHashes, dayjs: require('dayjs'),
  setIgnoredHashes: value => { context.ignoredHashes = value; },
  setLoading: value => loadingChanges.push(value), setError: () => {}, setLogs: () => {},
  console: { log() {}, error() {} }, setTimeout: callback => callback(), playNotificationSound() {},
  api: { getGitLogs: async () => { fetchCount += 1; return { logs }; }, showNotification: notice => notices.push(notice) },
  generateLog: async (entries, _template, _repos, options) => {
    calls.push({ entries, options });
    return outputs.shift();
  },
  handleSyncToXuexitong: async (content, _fool, date) => { synced.push({ content, date }); return { success: true }; }
};
const run = vm.runInNewContext(`(${closure})`, context);
await Promise.all([run('average'), run('average')]);
assert.equal(fetchCount, 1, 'Repeated clicks must not start a second batch');
assert.equal(calls.length, 5, 'Only a fully duplicated day is retried; partial unique content is preserved');
assert.equal(synced.length, 4, 'All dates receive distinct content after redistribution, including the day after duplicates');
assert.deepEqual(synced.map(item => item.date), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
assert.equal(calls[1].options.allocationContext.previousContents[0].content, first);
assert.equal(calls[3].options.allocationContext.rejectedContent, duplicateOnly);
assert.equal(calls[3].entries[0].hash, calls[2].entries[0].hash);
assert.ok(!calls[4].options.allocationContext.previousContents[1].content.includes('完善用户登录权限校验逻辑'));
assert.equal(calls[0].options.allocationContext.targetDate, '2026-11-01');
assert.equal(autoFillRunning.current, false);
assert.deepEqual(loadingChanges, [true, false]);
assert.match(notices.at(-1).body, /成功补全 4 天日志，失败 0 天/);
const allContent = synced.map(item => item.content).join('\n');
for (const text of ['完善用户登录权限校验逻辑', '修复用户登录验证码过期问题', '处理课程目录展示顺序错误', '实现作业附件下载鉴权功能']) assert.equal(allContent.split(text).length - 1, 1);
assert.ok(calls.every(call => call.entries.every(entry => !entry.hash.startsWith('merge-'))));
assert.equal(context.ignoredHashes.size, 4);
console.log('PASS: partial deduplication, empty-day redistribution, continued later generation, chronology and no lost unique tasks');

calls.length = 0;
context.ignoredHashes = new Set();
context.generateLog = async (entries, _template, _repos, options) => {
  calls.push({ entries, options });
  return second;
};
await run('daily');
assert.equal(calls.length, 4);
assert.ok(calls.every(call => call.entries.length === 1 && !call.entries[0].hash.startsWith('merge-')));
assert.equal(context.ignoredHashes.size, 4);
console.log('PASS: average and daily auto-fill default to ignoring merges, including fresh queries');

// A failed retry must still allow redistribution and later dates to complete.
synced.length = 0;
const recoveryOutputs = [first, second, duplicateOnly, fourth];
context.generateLog = async (_entries, _template, _repos, options) => {
  if (options.allocationContext?.rejectedContent) throw new Error('fixture retry failed');
  return recoveryOutputs.shift();
};
await run('average');
assert.equal(synced.length, 4);
assert.match(notices.at(-1).body, /成功补全 4 天日志，失败 0 天/);
console.log('PASS: retry failure still redistributes independent work and continues all later dates');
