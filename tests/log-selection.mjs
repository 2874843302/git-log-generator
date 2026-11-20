import assert from 'node:assert/strict';
import { isMergeCommit, getDefaultIgnoredHashes } from '../frontend/src/lib/logSelection.js';

const commits = [
  { hash: 'normal', message: '实现分支选择功能', parents: 'a' },
  { hash: 'merge', message: '自定义的合并标题', parents: 'a b' },
  { hash: 'octopus', message: '整合三个分支', parents: ['a', 'b', 'c'] },
  { hash: 'legacy', message: "Merge branch 'feature'" },
  { hash: 'legacy-pr', message: 'Merge pull request #10' },
  { hash: 'ordinary', message: 'Merge branch selector UI improvements', parents: 'a' },
  { hash: 'root', message: 'Merge tooling initial implementation', parents: '' }
];
assert.deepEqual(commits.filter(isMergeCommit).map(log => log.hash), ['merge', 'octopus', 'legacy', 'legacy-pr']);
assert.equal(isMergeCommit({}), false);
assert.equal(isMergeCommit({ message: 'fix: merge button' }), false);
const ignored = getDefaultIgnoredHashes(commits, new Set(['normal', 'stale']));
assert.deepEqual([...ignored], ['normal', 'merge', 'octopus', 'legacy', 'legacy-pr']);
// Restoring one merge or all merges must continue to work without changing the source records.
ignored.delete('merge');
assert.ok(commits.filter(log => !ignored.has(log.hash)).some(log => log.hash === 'merge'));
commits.filter(isMergeCommit).forEach(log => ignored.delete(log.hash));
assert.equal(commits.filter(log => isMergeCommit(log) && ignored.has(log.hash)).length, 0);
console.log('PASS: merge parent detection, legacy fallback, ordinary commit protection and manual restoration');
