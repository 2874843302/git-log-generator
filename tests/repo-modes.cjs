const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRepo } = require('./repo-discovery.cjs');
const root = path.resolve(__dirname, '..');

async function startTestApp() {
  const { app, BrowserWindow } = require('electron');
  const profile = process.env.REPO_MODE_TEST_PROFILE;
  app.setPath('userData', profile);
  process.chdir(profile);
  await app.whenReady();
  const database = require('../backend/database');
  database.initDatabase(profile);
  const workspace = path.join(profile, 'workspace');
  if (database.getSetting('BASE_REPO_DIR') === null) {
    database.setSettings({
      BASE_REPO_DIR: workspace, DEEPSEEK_API_KEY: 'fixture-only-not-a-credential', SCHEDULE_ENABLED: 'false',
      NOTIFICATION_SOUND_ENABLED: 'false',
      LAST_SELECTED_REPOS: ['alpha/client', 'alpha/server', 'beta/client', 'beta/server'].map(p => path.join(workspace, p)).join(','),
      FOOL_MODE_SELECTED_REPOS: ['alpha/client', 'beta/server'].map(p => path.join(workspace, p)).join(',')
    });
  }
  require('../backend/ipcHandlers').registerIpcHandlers();
  global.repoTest = { database, setRejectMode: enabled => {
    const db = new (require('better-sqlite3'))(path.join(profile, 'settings.db'));
    db.exec(enabled ? `CREATE TRIGGER reject_mode_fixture BEFORE UPDATE ON settings
      WHEN NEW.key = 'WHOLE_REPO_PATHS' BEGIN SELECT RAISE(ABORT, 'Repository mode fixture rejected'); END;`
      : 'DROP TRIGGER reject_mode_fixture');
    db.close();
  } };
  const win = new BrowserWindow({ show: false, width: 1280, height: 900,
    webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true, backgroundThrottling: false } });
  await win.loadFile(path.join(root, 'frontend/dist/index.html'));
  win.showInactive();
}

async function run() {
  const { _electron, expect } = require('playwright/test');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-modes-'));
  const workspace = path.join(profile, 'workspace');
  const alpha = path.join(workspace, 'alpha');
  const beta = path.join(workspace, 'beta');
  const normalize = p => path.resolve(p).toLowerCase();
  const sorted = repos => repos.map(normalize).sort();
  const artifacts = path.join(root, '.test', 'repo-modes');
  fs.mkdirSync(artifacts, { recursive: true });
  createRepo(alpha);
  createRepo(beta);
  const env = { ...process.env, REPO_MODE_TEST_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  let instance;
  const launch = () => _electron.launch({ executablePath: require('electron'), args: ['--disable-gpu', __filename], env });
  const checkSelection = async (expected, foolExpected) => {
    const values = await instance.evaluate(() => ({
      repos: global.repoTest.database.getSetting('LAST_SELECTED_REPOS').split(',').filter(Boolean),
      fool: global.repoTest.database.getSetting('FOOL_MODE_SELECTED_REPOS').split(',').filter(Boolean)
    }));
    assert.deepEqual(sorted(values.repos), sorted(expected));
    assert.deepEqual(sorted(values.fool), sorted(foolExpected));
  };
  try {
    instance = await launch();
    let page = await instance.firstWindow();
    await expect(page.getByRole('button', { name: '合并为整个仓库' })).toHaveCount(4);
    await page.getByRole('button', { name: '合并为整个仓库' }).first().click();
    await expect(page.getByRole('button', { name: '按子项目拆分' })).toBeEnabled();
    const wholeSelection = [alpha, path.join(beta, 'client'), path.join(beta, 'server')];
    const wholeFoolSelection = [alpha, path.join(beta, 'server')];
    await checkSelection(wholeSelection, wholeFoolSelection);
    await page.screenshot({ path: path.join(artifacts, 'whole-desktop.png'), animations: 'disabled' });
    console.log('PASS: merging existing projects keeps other repositories and migrates normal and scheduled selections');

    const discovery = await page.evaluate(base => window.electron.invoke('api:detectRepos', { path: base }), workspace);
    assert.deepEqual(sorted(discovery.repos), sorted(wholeSelection));
    await page.getByRole('button', { name: '傻瓜模式' }).click();
    await expect(page.getByText('已选', { exact: false }).filter({ hasText: '/ 3' })).toBeVisible();
    await page.screenshot({ path: path.join(artifacts, 'fool-mode.png'), animations: 'disabled' });
    await page.locator('button:has(svg.lucide-x)').click();
    console.log('PASS: automatic and fool-mode discovery honor the per-repository preference');

    await instance.close();
    instance = await launch();
    page = await instance.firstWindow();
    await expect(page.getByRole('button', { name: '按子项目拆分' })).toBeEnabled();
    await checkSelection(wholeSelection, wholeFoolSelection);
    console.log('PASS: mode and selected paths persist after application restart');

    await page.getByRole('button', { name: '按子项目拆分' }).click();
    await expect(page.getByRole('button', { name: '合并为整个仓库' })).toHaveCount(4);
    await checkSelection([path.join(alpha, 'client'), path.join(alpha, 'server'), path.join(beta, 'client'), path.join(beta, 'server')],
      [path.join(alpha, 'client'), path.join(alpha, 'server'), path.join(beta, 'server')]);
    console.log('PASS: splitting a whole repository restores project discovery and selection');

    await page.getByRole('button', { name: '添加新仓库' }).click();
    await page.getByRole('button', { name: 'alpha', exact: true }).click();
    await page.getByRole('checkbox', { name: '作为整个仓库添加' }).check();
    await page.screenshot({ path: path.join(artifacts, 'picker-desktop.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '确认选择', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: '作为整个仓库添加' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '按子项目拆分' })).toBeEnabled();
    await checkSelection(wholeSelection, wholeFoolSelection);
    console.log('PASS: folder picker can add a whole repository and replace existing project entries');

    await instance.evaluate(() => global.repoTest.setRejectMode(true));
    await page.getByRole('button', { name: '按子项目拆分' }).click();
    await expect(page.getByRole('alert')).toContainText('Repository mode fixture rejected');
    await expect(page.getByRole('button', { name: '按子项目拆分' })).toBeEnabled();
    await checkSelection(wholeSelection, wholeFoolSelection);
    console.log('PASS: database failure preserves mode and all selections and permits retry');

    await instance.evaluate(() => global.repoTest.setRejectMode(false));
    const nested = path.join(alpha, 'independent');
    createRepo(nested);
    const result = await page.evaluate(async data => {
      return window.electron.invoke('api:setRepoMode', data);
    }, { path: alpha, whole: true, repoPaths: [path.join(alpha, 'client'), nested, path.join(beta, 'client')], foolModeRepos: [] });
    assert.deepEqual(sorted(result.repoPaths), sorted([alpha, nested, path.join(beta, 'client')]));
    assert.deepEqual(result.foolModeRepos, []);
    console.log('PASS: separately selected nested repositories and an empty scheduled selection are preserved');
  } finally {
    if (instance) await instance.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

if (process.versions.electron) {
  startTestApp().catch(error => { console.error(error); require('electron').app.exit(1); });
} else {
  run().catch(error => { console.error(error); process.exitCode = 1; });
}
