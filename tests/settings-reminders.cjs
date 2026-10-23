const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildReminderSchedules } = require('../backend/reminderSchedule');
const root = path.resolve(__dirname, '..');

async function startTestApp() {
  const { app, BrowserWindow } = require('electron');
  const profile = process.env.REMINDER_TEST_PROFILE;
  app.setPath('userData', profile);
  process.chdir(profile);
  await app.whenReady();
  const database = require('../backend/database');
  database.initDatabase(profile);
  if (database.getSetting('DEEPSEEK_MODEL') === null) {
    database.setSettings({ DEEPSEEK_MODEL: 'deepseek-v4-flash', DEEPSEEK_API_KEY: 'fixture-only-not-a-credential',
      DAILY_EMAIL_ENABLED: 'false', WEEKLY_EMAIL_ENABLED: 'false', EMAIL_ADDRESS: 'fixture@example.invalid',
      SCHEDULE_ENABLED: 'false', NOTIFICATION_SOUND_ENABLED: 'false' });
  }
  const tasks = [];
  const cron = require(require.resolve('node-cron', { paths: [path.join(root, 'backend')] }));
  cron.schedule = (expression, callback) => {
    assert.equal(cron.validate(expression), true);
    const task = { expression, callback, destroyed: false, destroy() { this.destroyed = true; } };
    tasks.push(task);
    return task;
  };
  const requests = [];
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/v1/chat/completions');
    requests.push({ url, model: JSON.parse(options.body).model });
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Fixture response' } }] }) };
  };
  require('../backend/ipcHandlers').registerIpcHandlers();
  const scheduler = require('../backend/scheduler');
  let checks = 0;
  let sends = 0;
  scheduler.performLogCheck = async () => { checks++; return ['20261023']; };
  scheduler.sendReminderEmail = async () => { sends++; };
  scheduler.initCronJobs();
  const db = new (require('better-sqlite3'))(path.join(profile, 'settings.db'));
  db.exec(`CREATE TRIGGER IF NOT EXISTS reject_reminder_fixture BEFORE INSERT ON settings
    WHEN NEW.key = 'DAILY_EMAIL_TIME' AND NEW.value = '"09:10"'
    BEGIN SELECT RAISE(ABORT, 'Reminder fixture write rejected'); END;`);
  db.close();
  global.reminderTest = { database, tasks, requests, scheduler, get checks() { return checks; }, get sends() { return sends; } };
  const win = new BrowserWindow({ show: false, width: 1280, height: 900,
    webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true, backgroundThrottling: false } });
  await win.loadFile(path.join(root, 'frontend/dist/index.html'));
  win.showInactive();
}

async function run() {
  const { _electron, expect } = require('playwright/test');
  assert.deepEqual(buildReminderSchedules(), { DAILY_EMAIL_TIME: '0 20 * * *', WEEKLY_EMAIL_TIME: '0 21 * * 5' });
  assert.deepEqual(buildReminderSchedules({ DAILY_EMAIL_TIME: '00:00', WEEKLY_EMAIL_TIME: '23:59' }),
    { DAILY_EMAIL_TIME: '0 0 * * *', WEEKLY_EMAIL_TIME: '59 23 * * 5' });
  for (const time of ['', null, '24:00', '12:60', '8:30', '08:30:00', '1 * * * *']) {
    assert.throws(() => buildReminderSchedules({ DAILY_EMAIL_TIME: time }), /HH:mm/);
  }
  console.log('PASS: default schedules, midnight, 23:59 and invalid time validation');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-reminders-'));
  const artifacts = path.join(root, '.test', 'settings-reminders');
  fs.mkdirSync(artifacts, { recursive: true });
  const env = { ...process.env, REMINDER_TEST_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  let instance;
  const launch = () => _electron.launch({ executablePath: require('electron'), args: ['--disable-gpu', __filename], env });
  const activeExpressions = () => instance.evaluate(() => global.reminderTest.tasks.filter(t => !t.destroyed).map(t => t.expression));
  try {
    instance = await launch();
    let page = await instance.firstWindow();
    assert.deepEqual(await activeExpressions(), ['0 20 * * *', '0 21 * * 5']);
    await page.getByRole('button', { name: '全局设置', exact: true }).click();
    const model = page.getByRole('textbox', { name: 'AI 模型' });
    await model.fill(' ');
    await page.getByRole('button', { name: '保存模型', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('模型名称不能为空');
    await model.fill(' deepseek-custom-fixture ');
    await page.getByRole('button', { name: '保存模型', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('模型已保存');
    await expect(model).toHaveValue('deepseek-custom-fixture');
    await expect(page.getByRole('button', { name: '保存模型', exact: true })).toBeDisabled();
    await model.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'model-desktop.png'), animations: 'disabled' });
    await page.evaluate(async () => {
      await window.electron.invoke('api:generateAiLog', { logs: [], repoPaths: [], templateKey: 'daily' });
      await window.electron.invoke('api:chatWithAssistant', { messages: [{ role: 'user', content: 'Fixture' }] });
    });
    const requests = await instance.evaluate(() => global.reminderTest.requests);
    assert.equal(requests.length, 2);
    assert.equal(requests.every(r => r.model === 'deepseek-custom-fixture' && r.url === 'https://api.deepseek.com/v1/chat/completions'), true);
    assert.equal(await instance.evaluate(() => global.reminderTest.tasks.length), 2);
    console.log('PASS: arbitrary trimmed model persists and reaches generation and chat using the fixed DeepSeek endpoint');

    await page.getByRole('button', { name: '同步任务', exact: true }).click();
    const daily = page.getByLabel('每日提醒时间');
    const weekly = page.getByLabel('每周提醒时间');
    const save = page.getByRole('button', { name: '保存提醒时间', exact: true });
    await expect(daily).toHaveValue('20:00');
    await expect(weekly).toHaveValue('21:00');
    await daily.fill('');
    await save.click();
    await expect(page.getByRole('alert')).toContainText('有效');
    await daily.fill('08:45');
    await weekly.fill('19:25');
    await save.click();
    await expect(page.getByRole('status')).toHaveText('提醒时间已保存');
    await expect(save).toBeDisabled();
    assert.deepEqual(await activeExpressions(), ['45 8 * * *', '25 19 * * 5']);
    assert.equal(await instance.evaluate(() => global.reminderTest.tasks.filter(t => t.destroyed).length), 2);
    await save.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'reminders-desktop.png'), animations: 'disabled' });
    console.log('PASS: saving both reminder times immediately replaces old cron tasks without duplication');

    await instance.evaluate(async () => {
      for (const task of global.reminderTest.tasks.filter(t => !t.destroyed)) await task.callback();
    });
    assert.equal(await instance.evaluate(() => global.reminderTest.checks), 0);
    await page.getByRole('switch', { name: '每日未完成提醒', exact: true }).click();
    await expect(page.getByRole('switch', { name: '每日未完成提醒', exact: true })).toBeChecked();
    await instance.evaluate(async () => global.reminderTest.tasks.filter(t => !t.destroyed)[0].callback());
    assert.equal(await instance.evaluate(() => global.reminderTest.checks), 1);
    assert.equal(await instance.evaluate(() => global.reminderTest.sends), 1);
    console.log('PASS: disabled string values skip reminder work, enabled reminders execute the expected check');

    const rejected = await page.evaluate(async () => {
      const errors = [];
      for (const config of [{ DAILY_EMAIL_TIME: '24:00' }, { WEEKLY_EMAIL_TIME: '' }, { DEEPSEEK_MODEL: ' ' }]) {
        try { await window.electron.invoke('api:updateConfig', config); errors.push(false); }
        catch { errors.push(true); }
      }
      return errors.every(Boolean);
    });
    assert.equal(rejected, true);
    await daily.fill('09:10');
    await weekly.fill('18:10');
    await save.click();
    await expect(page.getByRole('alert')).toContainText('Reminder fixture write rejected');
    await expect(daily).toHaveValue('09:10');
    await expect(save).toBeEnabled();
    assert.deepEqual(await activeExpressions(), ['45 8 * * *', '25 19 * * 5']);
    assert.equal(await instance.evaluate(() => global.reminderTest.database.getSetting('WEEKLY_EMAIL_TIME')), '19:25');
    console.log('PASS: invalid IPC values and SQLite failures preserve persisted times and running schedules');

    await instance.close();
    instance = await launch();
    page = await instance.firstWindow();
    assert.deepEqual(await activeExpressions(), ['45 8 * * *', '25 19 * * 5']);
    await page.getByRole('button', { name: '全局设置', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'AI 模型' })).toHaveValue('deepseek-custom-fixture');
    await page.getByRole('button', { name: '同步任务', exact: true }).click();
    await expect(page.getByLabel('每日提醒时间')).toHaveValue('08:45');
    await expect(page.getByLabel('每周提醒时间')).toHaveValue('19:25');
    console.log('PASS: model and reminder times survive restart and initialize the saved schedules');
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
