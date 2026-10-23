const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const gitService = require('../backend/server/services/gitService');

function createRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init', '--quiet', dir]);
  for (const project of ['client', 'server']) {
    fs.mkdirSync(path.join(dir, project));
    fs.writeFileSync(path.join(dir, project, 'package.json'), JSON.stringify({ name: project }));
    execFileSync('git', ['-C', dir, 'add', project]);
    execFileSync('git', ['-C', dir, '-c', 'user.name=Regression', '-c', 'user.email=regression@example.invalid',
      'commit', '--quiet', '-m', project]);
  }
  fs.writeFileSync(path.join(dir, 'README.md'), 'Root-only change\n');
  execFileSync('git', ['-C', dir, 'add', 'README.md']);
  execFileSync('git', ['-C', dir, '-c', 'user.name=Regression', '-c', 'user.email=regression@example.invalid',
    'commit', '--quiet', '-m', 'root-only']);
}

async function run() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-discovery-'));
  const alpha = path.join(workspace, 'alpha');
  const beta = path.join(workspace, 'beta');
  const normalize = p => path.resolve(p).toLowerCase();
  const sorted = repos => repos.map(normalize).sort();
  try {
    createRepo(alpha);
    createRepo(beta);
    assert.deepEqual(sorted((await gitService.detectRepos(alpha)).repos),
      sorted([path.join(alpha, 'client'), path.join(alpha, 'server')]));
    console.log('PASS: default monorepo discovery is preserved');

    const options = { wholeRepoPaths: [alpha] };
    assert.deepEqual(sorted((await gitService.detectRepos(alpha, options)).repos), sorted([alpha]));
    assert.deepEqual(sorted((await gitService.detectRepos(path.join(alpha, 'client'), options)).repos), sorted([alpha]));
    assert.deepEqual(sorted((await gitService.detectRepos(workspace, options)).repos),
      sorted([alpha, path.join(beta, 'client'), path.join(beta, 'server')]));
    console.log('PASS: per-repository preference works for root, child and recursive mixed discovery');

    if (process.platform === 'win32') {
      assert.deepEqual(sorted((await gitService.detectRepos(alpha, { wholeRepoPaths: [alpha.toUpperCase() + '/'] })).repos),
        sorted([alpha]));
      console.log('PASS: Windows path case, separator and trailing slash normalization');
    }
    assert.equal((await gitService.getGitLogs(alpha)).length, 3);
    assert.equal((await gitService.getGitLogs(path.join(alpha, 'client'))).length, 1);
    console.log('PASS: whole-repository logs include root and both projects, child logs remain filtered');

    const worktree = path.join(workspace, 'linked');
    execFileSync('git', ['-C', alpha, 'worktree', 'add', '--quiet', '--detach', worktree]);
    assert.equal(fs.statSync(path.join(worktree, '.git')).isFile(), true);
    assert.deepEqual(sorted((await gitService.detectRepos(workspace, { wholeRepoPaths: [worktree] })).repos),
      sorted([path.join(alpha, 'client'), path.join(alpha, 'server'), path.join(beta, 'client'), path.join(beta, 'server'), worktree]));
    console.log('PASS: worktrees using a .git file support whole-repository mode');
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { createRepo };
