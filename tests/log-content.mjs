import assert from 'node:assert/strict';
import { removeRepeatedWorkItems, rebalanceGeneratedContents } from '../frontend/src/lib/logContent.js';

const daily = (project, ...items) => `1\\. ${project}: 已完成--8h\n\n${items.map(item => `功能优化: ${item}`).join('\n\n')}`;
const prior = daily('项目A', '登录鉴权');
const partial = removeRepeatedWorkItems(`${daily('项目A', '登录鉴权', '导出报表', '导出报表')}\n\n2. 空项目: 已完成--2h`, [prior]);
assert.equal(partial.removedCount, 2);
assert.ok(partial.content.includes('导出报表'));
assert.ok(!partial.content.includes('登录鉴权'));
assert.ok(!partial.content.includes('空项目'));
assert.match(partial.content, /已完成--8h/);
assert.equal(removeRepeatedWorkItems(daily('项目B', '登录鉴权'), [prior]).removedCount, 0);
assert.equal(removeRepeatedWorkItems(daily('项目A', '登录鉴权。'), [prior]).content, '');
const markdown = removeRepeatedWorkItems('## 项目A\n\n### 完成事项\n\n1. 实现用户登录鉴权\n\n2. 新增课程报表导出\n\n## 空项目', ['## 项目A\n\n### 完成事项\n\n- 实现用户登录鉴权']);
assert.equal(markdown.removedCount, 1);
assert.ok(markdown.content.includes('## 项目A'));
assert.ok(markdown.content.includes('新增课程报表导出'));
assert.ok(!markdown.content.includes('空项目'));
const noHours = removeRepeatedWorkItems('1. 项目A: 已完成\n\n需求处理: 导出报表');
assert.ok(!noHours.content.includes('h'));

const entries = [
  { date: '2026-11-01', content: daily('项目A', '登录鉴权', '导出报表', '权限修复'), error: null },
  { date: '2026-11-02', content: '', needsRedistribution: true, error: null },
  { date: '2026-11-03', content: daily('项目B', '附件下载', '课程排序'), error: null }
];
const repaired = rebalanceGeneratedContents(entries);
assert.equal(repaired.length, 3);
assert.ok(repaired.every(entry => entry.content && !entry.error));
const descriptions = repaired.flatMap(entry => entry.content.split('\n').filter(line => line.startsWith('功能优化: ')));
assert.deepEqual(descriptions, ['登录鉴权', '导出报表', '权限修复', '附件下载', '课程排序'].map(text => `功能优化: ${text}`));
assert.equal(entries[1].content, '', 'Inputs are not mutated');
const scarce = rebalanceGeneratedContents([{ date: '2026-11-01', content: prior }, { date: '2026-11-02', content: '', needsRedistribution: true }]);
assert.match(scarce[1].error, /独立工作条目不足/);
const failed = { date: '2026-11-04', content: null, error: 'API失败' };
assert.deepEqual(rebalanceGeneratedContents([...entries, failed]).at(-1), failed);
console.log('PASS: item deduplication, short tasks, project isolation, headings, hours, chronological redistribution and honest source scarcity');
