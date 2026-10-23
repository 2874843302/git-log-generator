const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const expected = {
  SMTP_HOST: 'smtp.example.invalid',
  SMTP_PORT: 587,
  SMTP_USER: 'sender@example.invalid',
  SMTP_PASS: 'fixture-only-not-a-credential',
  FROM_NAME: 'SMTP Regression'
};

async function startTestApp() {
  const { app, BrowserWindow, ipcMain } = require('electron');
  const profile = process.env.SMTP_TEST_PROFILE;
  app.setPath('userData', profile);
  process.chdir(profile);
  await app.whenReady();

  const database = require('../backend/database');
  assert.throws(() => database.setSettings(expected), /数据库尚未初始化/);
  database.initDatabase(profile);
  if (database.getSetting('SMTP_HOST') === null) {
    database.setSettings({
      SMTP_HOST: 'old.example.invalid', SMTP_PORT: '465', SMTP_USER: '', SMTP_PASS: '', FROM_NAME: '',
      SCHEDULE_ENABLED: 'false', NOTIFICATION_SOUND_ENABLED: 'false'
    });
  }
  let smtpSaves = 0;
  const originalHandle = ipcMain.handle;
  ipcMain.handle = (channel, handler) => originalHandle.call(ipcMain, channel,
    channel === 'api:updateConfig' ? async (event, config) => {
      if (Object.hasOwn(config, 'SMTP_HOST')) {
        smtpSaves += 1;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return handler(event, config);
    } : handler);
  try {
    require('../backend/ipcHandlers').registerIpcHandlers();
  } finally {
    ipcMain.handle = originalHandle;
  }

  // A real SQLite failure after earlier fields were written must roll back the batch.
  const db = new (require('better-sqlite3'))(path.join(profile, 'settings.db'));
  db.exec(`CREATE TRIGGER IF NOT EXISTS reject_smtp_fixture
    BEFORE UPDATE ON settings
    WHEN NEW.key = 'SMTP_USER' AND NEW.value = '"reject@example.invalid"'
    BEGIN SELECT RAISE(ABORT, 'SMTP fixture write rejected'); END;`);
  db.close();

  global.smtpTest = { database, emailConfig: require('../backend/emailConfig'), get saves() { return smtpSaves; } };
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true, backgroundThrottling: false }
  });
  await win.loadFile(path.join(root, 'frontend/dist/index.html'));
  win.showInactive();
}

async function run() {
  const { _electron, expect } = require('playwright/test');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'smtp-settings-'));
  const artifacts = path.join(root, '.test', 'smtp-settings');
  fs.mkdirSync(artifacts, { recursive: true });
  const env = { ...process.env, SMTP_TEST_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  let instance;
  const launch = () => _electron.launch({
    executablePath: require('electron'), args: ['--disable-gpu', __filename], env, timeout: 30000
  });
  const openSettings = async page => {
    await page.getByRole('button', { name: '全局设置', exact: true }).click();
    await page.getByRole('button', { name: '邮件服务器', exact: true }).click();
    await expect(page.getByPlaceholder('smtp.qq.com')).toBeVisible();
  };
  const verifySaved = async () => {
    const ok = await instance.evaluate((_, settings) => Object.entries(settings).every(
      ([key, value]) => global.smtpTest.database.getSetting(key) === value &&
        process.env[key] === String(value) && String(global.smtpTest.emailConfig[key]) === String(value)
    ), expected);
    assert.equal(ok, true, 'SQLite and runtime configuration must match saved values');
  };
  try {
    instance = await launch();
    let page = await instance.firstWindow();
    await openSettings(page);
    const save = page.getByRole('button', { name: '保存服务器配置', exact: true });
    await expect(save).toBeDisabled();
    await page.getByPlaceholder('smtp.qq.com').fill(expected.SMTP_HOST);
    await page.getByPlaceholder('465').fill('');
    await save.click();
    await expect(page.getByRole('alert')).toContainText('有效端口');
    await page.getByPlaceholder('465').fill('65536');
    await save.click();
    await expect(page.getByRole('alert')).toContainText('有效端口');
    assert.equal(await instance.evaluate(() => global.smtpTest.saves), 0);
    await page.getByPlaceholder('465').fill(String(expected.SMTP_PORT));
    await page.getByPlaceholder('your-email@qq.com').fill(expected.SMTP_USER);
    await page.getByPlaceholder('请输入 SMTP 授权码').fill(expected.SMTP_PASS);
    await page.getByPlaceholder('Git Log Generator', { exact: true }).fill(expected.FROM_NAME);
    await save.click();
    await expect(page.getByRole('button', { name: '正在保存...' })).toBeDisabled();
    await expect(page.getByPlaceholder('smtp.qq.com')).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('服务器配置已保存');
    await expect(save).toBeDisabled();
    assert.equal(await instance.evaluate(() => global.smtpTest.saves), 1);
    await verifySaved();
    await page.screenshot({ path: path.join(artifacts, 'saved-desktop.png') });
    console.log('PASS: port validation, single batch, pending state, success state, database and runtime values');

    await page.locator('button:has(svg.lucide-x)').click();
    await openSettings(page);
    await expect(page.getByPlaceholder('smtp.qq.com')).toHaveValue(expected.SMTP_HOST);
    await expect(page.getByPlaceholder('请输入 SMTP 授权码')).toHaveValue(expected.SMTP_PASS);
    await expect(save).toBeDisabled();
    console.log('PASS: reopening settings retains saved values');

    await page.getByPlaceholder('smtp.qq.com').fill(` ${expected.SMTP_HOST} `);
    await page.getByPlaceholder('your-email@qq.com').fill(` ${expected.SMTP_USER} `);
    await page.getByPlaceholder('Git Log Generator', { exact: true }).fill(` ${expected.FROM_NAME} `);
    await save.click();
    await expect(page.getByRole('status')).toHaveText('服务器配置已保存');
    await expect(save).toBeDisabled();
    await expect(page.getByPlaceholder('smtp.qq.com')).toHaveValue(expected.SMTP_HOST);
    await verifySaved();
    console.log('PASS: whitespace normalization synchronizes the form even when stored values are unchanged');

    await page.getByPlaceholder('smtp.qq.com').fill('should-rollback.example.invalid');
    await page.getByPlaceholder('your-email@qq.com').fill('reject@example.invalid');
    await save.click();
    await expect(page.getByRole('alert')).toContainText('SMTP fixture write rejected');
    await expect(save).toBeEnabled();
    await expect(page.getByPlaceholder('your-email@qq.com')).toHaveValue('reject@example.invalid');
    await verifySaved();
    await expect(page.getByRole('status')).toHaveCount(0);
    await page.screenshot({ path: path.join(artifacts, 'failed-desktop.png') });
    console.log('PASS: failed SQLite write rolls back all fields, preserves runtime and draft, shows error');

    await page.getByPlaceholder('smtp.qq.com').fill(expected.SMTP_HOST);
    await page.getByPlaceholder('your-email@qq.com').fill(expected.SMTP_USER);
    await page.getByPlaceholder('465').fill('465');
    await save.click();
    await expect(page.getByRole('status')).toHaveText('服务器配置已保存');
    expected.SMTP_PORT = 465;
    await verifySaved();
    await instance.close();
    instance = await launch();
    page = await instance.firstWindow();
    await openSettings(page);
    await expect(page.getByPlaceholder('smtp.qq.com')).toHaveValue(expected.SMTP_HOST);
    await expect(page.getByPlaceholder('465')).toHaveValue('465');
    await expect(page.getByPlaceholder('your-email@qq.com')).toHaveValue(expected.SMTP_USER);
    await expect(page.getByPlaceholder('请输入 SMTP 授权码')).toHaveValue(expected.SMTP_PASS);
    await expect(page.getByPlaceholder('Git Log Generator', { exact: true })).toHaveValue(expected.FROM_NAME);
    await expect(page.getByRole('button', { name: '保存服务器配置', exact: true })).toBeDisabled();
    await verifySaved();
    console.log('PASS: retry succeeds and all five settings survive application restart');
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
