const { exec } = require('child_process');
const path = require('path');
const { app } = require('electron');
const cron = require('node-cron');
const { getSetting } = require('./database');
const emailConfig = require('./emailConfig');
const { chromium } = require('playwright');
const nodemailer = require('nodemailer');
const dayjs = require('dayjs');

/**
 * Windows 任务计划程序管理服务
 */
class SchedulerService {
    constructor() {
        this.taskName = 'GitLogGeneratorAutoSync';
        this.cronJobs = [];
    }

    /**
     * 初始化定时任务 (内存中的 cron，用于应用运行期间的邮件提醒)
     */
    initCronJobs() {
        // 1. 每日晚八点提醒 (20:00)
        const dailyJob = cron.schedule('0 20 * * *', () => {
            console.log('[Scheduler] 触发每日日志检查提醒 (20:00)');
            this.checkAndSendReminder('daily');
        });

        // 2. 每周五晚九点提醒 (21:00)
        const weeklyJob = cron.schedule('0 21 * * 5', () => {
            console.log('[Scheduler] 触发每周日志检查提醒 (周五 21:00)');
            this.checkAndSendReminder('weekly');
        });

        this.cronJobs.push(dailyJob, weeklyJob);
        console.log('[Scheduler] 内存定时任务已初始化');
    }

    /**
     * 检查日志完成情况并发送邮件提醒
     * @param {'daily' | 'weekly'} type 提醒类型
     */
    async checkAndSendReminder(type) {
        try {
            const emailEnabled = type === 'daily' 
                ? getSetting('DAILY_EMAIL_ENABLED') 
                : getSetting('WEEKLY_EMAIL_ENABLED');
            
            if (!emailEnabled) {
                console.log(`[Scheduler] ${type} 邮件提醒未开启，跳过`);
                return;
            }

            const targetEmail = getSetting('EMAIL_ADDRESS');
            if (!targetEmail) {
                console.warn(`[Scheduler] ${type} 邮件提醒已开启但未设置收件邮箱，跳过`);
                return;
            }

            // 检查学习通日志
            console.log(`[Scheduler] 正在检查学习通日志完成情况 (${type})...`);
            const missingDates = await this.performLogCheck();

            if (missingDates && missingDates.length > 0) {
                console.log(`[Scheduler] 发现缺失日志: ${missingDates.join(', ')}，正在准备发送邮件...`);
                await this.sendReminderEmail(targetEmail, type, missingDates);
            } else {
                console.log(`[Scheduler] 日志已全部完成，无需提醒`);
            }
        } catch (error) {
            console.error(`[Scheduler] 执行 ${type} 提醒逻辑失败:`, error);
        }
    }

    /**
     * 执行学习通日志检查 (Playwright)
     */
    async performLogCheck() {
        const username = getSetting('XUEXITONG_USERNAME');
        const password = getSetting('XUEXITONG_PASSWORD');
        const targetUrl = getSetting('XUEXITONG_LOG_CHECK_URL') || 'https://note.chaoxing.com/pc/index';
        const browserPath = getSetting('BROWSER_PATH');

        if (!username || !password) return [];

        let browser = null;
        try {
            const launchOptions = {
                headless: true,
                args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
            };
            if (browserPath && require('fs').existsSync(browserPath)) {
                launchOptions.executablePath = browserPath;
            }

            browser = await chromium.launch(launchOptions);
            const context = await browser.newContext();
            const page = await context.newPage();

            await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });

            // 登录逻辑
            if (page.url().includes('login') || await page.$('input#phone')) {
                await page.fill('input#phone', username);
                await page.fill('input#pwd', password);
                await page.click('button#loginBtn');
                await page.waitForURL('**chaoxing.com/**', { timeout: 60000 });
            }

            // 获取最近7天的日期字符串 (YYYYMMDD)
            const targetDates = [];
            for (let i = 0; i < 7; i++) {
                const d = dayjs().subtract(i, 'day');
                // 仅检查工作日 (1-5)
                if (d.day() !== 0 && d.day() !== 6) {
                    targetDates.push(d.format('YYYYMMDD'));
                }
            }

            // 等待并获取标题
            const listSelector = '.notebookPage .subPageMain .centerMain .dataCon .itemList, #activitysMe, .itemList';
            await page.waitForSelector(listSelector, { timeout: 30000 });
            
            const titles = await page.$$eval('.li_title_text', (elements) => 
                elements.map(el => {
                    const link = el.querySelector('a');
                    return (link ? link.textContent : el.textContent).trim();
                }).filter(t => t.length > 0)
            );

            const missingDates = targetDates.filter(target => {
                const year = target.substring(0, 4);
                const month = target.substring(4, 6);
                const day = target.substring(6, 8);
                const normalizedMonth = month.replace(/^0/, '');
                const normalizedDay = day.replace(/^0/, '');

                const exactFormats = [
                    target,
                    `${year}-${month}-${day}`,
                    `${year}/${month}/${day}`,
                    `${year}年${month}月${day}日`,
                    `${year}年${normalizedMonth}月${normalizedDay}日`
                ];

                return !titles.some(title => exactFormats.some(f => title.includes(f)));
            });

            return missingDates;
        } catch (err) {
            console.error('[Scheduler] 日志检查失败:', err);
            return [];
        } finally {
            if (browser) await browser.close();
        }
    }

    /**
     * 发送提醒邮件
     */
    async sendReminderEmail(to, type, missingDates) {
        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_NAME } = emailConfig;

        if (!SMTP_USER || !SMTP_PASS || SMTP_PASS === 'your_auth_code_here') {
            console.warn('[Scheduler] 未配置或配置了错误的 SMTP 发件信息，无法发送提醒邮件。请检查 backend/emailConfig.js');
            return;
        }

        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT),
            secure: parseInt(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS }
        });

        const subject = type === 'daily' 
            ? `【每日提醒】您有未完成的工作日志 (${dayjs().format('YYYY-MM-DD')})`
            : `【每周总结】本周日志完成情况检查报告`;
        
        const content = type === 'daily'
            ? `<p>您好，系统检测到您在学习通中尚未同步今日（或近期工作日）的工作日志。</p>
               <p><b>缺失日期：</b>${missingDates.join(', ')}</p>
               <p>请及时登录 Git Log Generator 完成同步。</p>`
            : `<p>您好，这是本周的工作日志完成情况检查报告。</p>
               <p><b>以下日期发现日志缺失：</b></p>
               <ul>${missingDates.map(d => `<li>${d}</li>`).join('')}</ul>
               <p>建议您在周末前补全所有日志。</p>`;

        await transporter.sendMail({
            from: `"${FROM_NAME}" <${SMTP_USER}>`,
            to,
            subject,
            html: content + `<br/><hr/><p style="font-size: 12px; color: #999;">此邮件由系统自动发出，请勿直接回复。</p>`
        });
        console.log(`[Scheduler] 提醒邮件已发送至 ${to}`);
    }

    /**
     * 更新或创建 Windows 任务计划
     * @param {boolean} enabled 是否启用
     * @param {string} time 触发时间 (HH:mm)
     */
    async syncTask(enabled, time) {
        if (process.platform !== 'win32') return;

        // 1. 先尝试删除旧任务（无论是否存在）
        await this.deleteTask();

        // 2. 如果启用了定时任务，则创建新任务
        if (enabled && time) {
            await this.createTask(time);
        }
    }

    /**
     * 创建定时启动任务
     * @param {string} time 时间格式 HH:mm
     */
    createTask(time) {
        return new Promise((resolve, reject) => {
            const exePath = app.getPath('exe');
            // 使用 schtasks 创建每日任务
            // /create: 创建任务
            // /tn: 任务名称
            // /tr: 运行的程序路径
            // /sc: 计划频率 (daily)
            // /st: 开始时间 (HH:mm)
            // /f: 强制创建，如果已存在则覆盖
            const command = `schtasks /create /tn "${this.taskName}" /tr "\\"${exePath}\\"" /sc daily /st ${time} /f`;
            
            console.log(`[Scheduler] 正在创建 Windows 任务: ${command}`);
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[Scheduler] 创建任务失败: ${stderr}`);
                    return reject(new Error('无法创建 Windows 任务计划: ' + stderr));
                }
                console.log(`[Scheduler] 任务创建成功: ${stdout}`);
                resolve(stdout);
            });
        });
    }

    /**
     * 删除定时启动任务
     */
    deleteTask() {
        return new Promise((resolve) => {
            const command = `schtasks /delete /tn "${this.taskName}" /f`;
            
            console.log(`[Scheduler] 正在尝试删除 Windows 任务: ${this.taskName}`);
            
            exec(command, (error, stdout, stderr) => {
                // 如果任务不存在，会返回错误，我们忽略它
                if (error) {
                    console.log(`[Scheduler] 删除任务时（可能不存在）: ${stderr}`);
                } else {
                    console.log(`[Scheduler] 任务删除成功: ${stdout}`);
                }
                resolve();
            });
        });
    }
}

module.exports = new SchedulerService();
