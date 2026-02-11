const { ipcMain, Notification, app } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { marked } = require('marked');
const nodemailer = require('nodemailer');

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
});
const gitService = require('./server/services/gitService');
const aiService = require('./server/services/aiService');
const scheduler = require('./scheduler');
const { templates } = require('./server/constants/templates');
const { getSetting, setSetting, getAllSettings } = require('./database');
const emailConfig = require('./emailConfig');

/**
 * 迁移 .env 文件到 SQLite (仅在 SQLite 中没有对应键时迁移)
 */
function migrateEnvToSqlite() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        // 忽略注释和空行
        if (line.trim() && !line.startsWith('#')) {
          const firstEqualIndex = line.indexOf('=');
          if (firstEqualIndex !== -1) {
            const key = line.substring(0, firstEqualIndex).trim();
            const value = line.substring(firstEqualIndex + 1).trim().replace(/^["']|["']$/g, '');
            
            // 如果数据库里没有，才迁移
            if (getSetting(key) === null) {
              setSetting(key, value);
              console.log(`从 .env 迁移配置: ${key}`);
            }
          }
        }
      });
    } catch (err) {
      console.error('迁移 .env 失败:', err);
    }
  }
}

// 执行迁移
migrateEnvToSqlite();

// 将数据库中的配置加载到 process.env
const allSettings = getAllSettings();
Object.entries(allSettings).forEach(([key, value]) => {
  process.env[key] = value;
});

// 应用启动时，确保 Windows 任务计划与配置同步
const initialScheduleEnabled = allSettings.SCHEDULE_ENABLED === 'true' || allSettings.SCHEDULE_ENABLED === true;
const initialScheduleTime = allSettings.SCHEDULE_TIME;
if (initialScheduleEnabled && initialScheduleTime) {
  scheduler.syncTask(true, initialScheduleTime).catch(err => {
    console.error('[Init] 同步 Windows 任务计划失败:', err);
  });
}

// Playwright 浏览器实例单例，避免重复启动
let browserInstance = null; // 记录浏览器实例
let browserContext = null;  // 记录浏览器上下文
let lastUsedBrowserPath = null; // 记录上一次使用的浏览器路径
let lastUsedHeadless = null;    // 记录上一次使用的无头模式

/**
 * 确保浏览器已关闭
 */
async function closeBrowser() {
  if (browserContext) {
    await browserContext.close().catch(() => {});
    browserContext = null;
  }
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

function registerIpcHandlers() {
  // 学习通日志检查 (放在最前面确保优先注册)
  ipcMain.handle('api:checkXuexitongLogs', async (event, { headless = true }) => {
    console.log(`[Backend] checkXuexitongLogs called. headless: ${headless}`);
    
    // 优先从环境变量获取，如果没有则使用默认 URL
    const targetUrl = process.env.XUEXITONG_LOG_CHECK_URL || 'https://note.chaoxing.com/pc/index';
    const username = process.env.XUEXITONG_USERNAME;
    const password = process.env.XUEXITONG_PASSWORD;
    const customBrowserPath = process.env.BROWSER_PATH;

    if (!username || !password) {
      throw new Error('未配置学习通账号密码，请在设置中配置后再试');
    }

    // 1. 计算本周的工作日
    const getWorkdays = () => {
      const workdays = [];
      let current = new Date();
      current.setHours(0, 0, 0, 0);
      
      const dayOfWeek = current.getDay(); // 0 (Sun) to 6 (Sat)
      
      // 计算本周一的日期
      // 如果今天是周日(0)，则周一是 6 天前
      // 如果今天是周一(1)，则周一是今天
      // 如果今天是周二(2)，则周一是 1 天前
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      const monday = new Date(current);
      monday.setDate(current.getDate() - daysSinceMonday);
      
      // 从周一循环到今天
      let temp = new Date(monday);
      while (temp <= current) {
        const d = temp.getDay();
        if (d !== 0 && d !== 6) { // 排除周六周日
          workdays.push(new Date(temp));
        }
        temp.setDate(temp.getDate() + 1);
      }
      return workdays;
    };

    const targetDates = getWorkdays();
    const targetDateStrings = targetDates.map(d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    });

    try {
      // 2. 启动浏览器
      console.log(`[Backend] Target URL: ${targetUrl}`);
      console.log(`[Backend] Target dates to check: ${targetDateStrings.join(', ')}`);

      if (!browserContext) {
        console.log('[Backend] Launching new browser instance...');
        const launchOptions = {
          headless: headless,
          executablePath: customBrowserPath || undefined,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        try {
          if (customBrowserPath) {
            console.log(`[Backend] Using custom browser path: ${customBrowserPath}`);
            browserInstance = await chromium.launch(launchOptions);
            browserContext = await browserInstance.newContext({
              viewport: { width: 1280, height: 800 }
            });
          } else {
            const userDataDir = path.join(process.cwd(), 'playwright-data');
            console.log(`[Backend] Using persistent context at: ${userDataDir}`);
            if (!fs.existsSync(userDataDir)) {
              fs.mkdirSync(userDataDir, { recursive: true });
            }
            browserContext = await chromium.launchPersistentContext(userDataDir, launchOptions);
            browserInstance = browserContext.browser();
          }
        } catch (launchError) {
          console.error('[Backend] Failed to launch browser:', launchError);
          throw new Error(`无法启动浏览器: ${launchError.message}`);
        }
      }

      const page = await browserContext.newPage();
      console.log('[Backend] New page created.');
      
      // 3. 访问并处理登录
      console.log(`[Backend] Navigating to ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log(`[Backend] Current URL after navigation: ${page.url()}`);
      
      // 检查是否在登录页
      const isLoginPage = page.url().includes('login') || await page.$('input#phone');
      if (isLoginPage) {
        console.log('[Backend] Detected login page, performing login for user:', username);
        await page.fill('input#phone', username);
        await page.fill('input#pwd', password);
        await page.click('button#loginBtn');
        console.log('[Backend] Login button clicked, waiting for navigation...');
        // 等待登录成功并跳转回主页或笔记页
        await page.waitForURL(url => url.href.includes('chaoxing.com') && !url.href.includes('login'), { timeout: 60000 });
        await page.waitForLoadState('networkidle');
        console.log(`[Backend] Navigation complete. New URL: ${page.url()}`);
      } else {
        console.log('[Backend] Not on login page, proceeding...');
      }

      // 4. 确保在笔记列表页，且不在“写笔记”页面
      const isNotePage = () => {
        const url = page.url();
        const isBaseNoteDomain = url.includes('note.chaoxing.com') || url.includes('noteyd.chaoxing.com');
        const isCreatePage = url.includes('jumpToAddNote') || url.includes('isCreate=true');
        return isBaseNoteDomain && !isCreatePage;
      };
      
      if (!isNotePage() || page.url().includes('login')) {
        console.log(`[Backend] Not on note list page (Current: ${page.url()}), forcing navigation to targetUrl...`);
        // 强制跳转到列表页，并确保 URL 不带创建参数
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
      } else {
        console.log('[Backend] Already on note list page.');
      }

      // 5. 等待列表加载并抓取标题
      console.log('[Backend] Waiting for note list content (#activitysMe or .itemList)...');
      
      // 根据用户提供的结构，层级为 .notebookPage > .subPageMain > .centerMain > .dataCon > .itemList
      const listSelector = '.notebookPage .subPageMain .centerMain .dataCon .itemList, #activitysMe, .itemList';
      try {
        await page.waitForSelector(listSelector, { timeout: 30000, state: 'attached' });
        console.log('[Backend] List content selector detected.');
      } catch (timeoutErr) {
        console.error('[Backend] Timeout waiting for list content. Current URL:', page.url());
        const content = await page.content();
        console.log('[Backend] Page content preview (first 500 chars):', content.substring(0, 500));
        throw new Error('未能加载笔记列表，请检查网络或是否已正确登录。当前页面：' + page.url());
      }
      
      // 额外等待一下确保异步加载完成
      console.log('[Backend] Giving page extra time to stabilize...');
      await page.waitForTimeout(1000); // 从 3000 减少到 1000
      
      // 滚动一下确保加载更多内容
      console.log('[Backend] Scrolling to ensure list items are rendered...');
      await page.evaluate(() => {
        const list = document.querySelector('.itemList') || document.querySelector('#activitysMe') || document.body;
        list.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
      await page.waitForTimeout(1000); // 从 2000 减少到 1000

      // 获取所有可能的标题文本
      console.log('[Backend] Extracting note titles...');
      const titles = await page.$$eval('.li_title_text', (elements) => 
        elements.map(el => {
          // 用户提供的结构中，标题文本在 span > a 内部
          // <span class="li_title_text"><a style="color: #0099ff;">20260126</a></span>
          const link = el.querySelector('a');
          const text = (link ? link.textContent : el.textContent).trim();
          return text;
        }).filter(t => t.length > 0)
      );
      
      console.log(`[Backend] Found ${titles.length} titles in current view.`);
      if (titles.length > 0) {
        console.log('[Backend] Sample titles:', titles.slice(0, 3).join(' | '));
      }
      
      await page.close();
      console.log('[Backend] Page closed.');

      // 6. 比对结果
      console.log('[Backend] Comparing found titles with target dates...');
      const missingDates = targetDateStrings.filter(target => {
        // 1. 首先检查是否有精确匹配（标题完全包含 YYYYMMDD 格式）
        const hasExactMatch = titles.some(title => title.includes(target));
        if (hasExactMatch) {
          console.log(`[Backend] Found exact match for ${target}`);
          return false; // 不包含在缺失列表中
        }
        
        // 2. 如果没有精确匹配，检查是否有其他日期格式（如 2026-02-03, 2026/02/03, 02/03/2026 等）
        const year = target.substring(0, 4);
        const month = target.substring(4, 6);
        const day = target.substring(6, 8);
        
        // 处理月份和日期的前导0
        const normalizedMonth = month.replace(/^0/, ''); // 01 -> 1
        const normalizedDay = day.replace(/^0/, ''); // 08 -> 8
        
        // 只匹配完整的日期格式，避免零散数字组合匹配
        // 支持：YYYY-MM-DD, YYYY/MM/DD, MM-DD-YYYY, MM/DD/YYYY, YYYY年MM月DD日
        // 以及不带分隔符的精确格式（如 YYYYMMDD, YYYYMD, YYYYMMD, YYYYMD 等）
        const exactFormats = [
          `${year}[-/]${month}[-/]${day}`, // 2026-02-03, 2026/02/03
          `${year}[-/]${normalizedMonth}[-/]${normalizedDay}`, // 2026-2-3, 2026/2/3
          `${month}[-/]${day}[-/]${year}`, // 02-03-2026, 02/03/2026
          `${normalizedMonth}[-/]${normalizedDay}[-/]${year}`, // 2-3-2026, 2/3/2026
          `${year}年${month}月${day}日`, // 2026年02月03日
          `${year}年${normalizedMonth}月${normalizedDay}日`, // 2026年2月3日
          `${year}${month}${day}`, // 20260203
          `${year}${normalizedMonth}${day}`, // 2026203
          `${year}${month}${normalizedDay}`, // 2026023
          `${year}${normalizedMonth}${normalizedDay}` // 202623
        ];
        
        // 检查是否有任何格式匹配
        const hasFormatMatch = titles.some(title => {
          return exactFormats.some(format => title.includes(format));
        });
        
        if (hasFormatMatch) {
          console.log(`[Backend] Found format match for ${target}`);
          return false; // 不包含在缺失列表中
        }
        
        // 3. 如果都没有匹配，则认为是缺失的
        console.log(`[Backend] No match found for ${target}`);
        return true;
      });

      return { 
        success: true, 
        missingDates, 
        foundTitlesCount: titles.length,
        checkedCount: targetDateStrings.length 
      };

    } catch (error) {
      console.error('检查学习通日志失败:', error);
      throw new Error('检查失败: ' + error.message);
    } finally {
        // 不再每次检查都关闭浏览器，改为保持实例运行
        // if (headless) {
        //   await closeBrowser();
        // }
      }
  });

  // Folder & Config 相关
  ipcMain.handle('api:getDrives', async () => {
    if (process.platform === 'win32') {
      return new Promise((resolve) => {
        exec('wmic logicaldisk get name', (error, stdout) => {
          if (error) return resolve({ drives: ['C:/'] });
          const drives = stdout.split('\r\n')
            .filter(value => /[A-Za-z]:/.test(value))
            .map(value => value.trim() + '/');
          resolve({ drives });
        });
      });
    } else {
      return { drives: ['/'] };
    }
  });

  ipcMain.handle('api:listDir', async (event, { dirPath }) => {
    try {
      const targetPath = dirPath || (process.platform === 'win32' ? 'C:/' : '/');
      const files = fs.readdirSync(targetPath, { withFileTypes: true });
      const folders = files
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      let resolvedPath = path.resolve(targetPath);
      // 确保路径以分隔符结尾，方便前端拼接
      if (!resolvedPath.endsWith(path.sep)) {
        resolvedPath += path.sep;
      }
      
      return {
        currentPath: resolvedPath,
        folders
      };
    } catch (error) {
      throw new Error('读取目录失败: ' + error.message);
    }
  });

  ipcMain.handle('api:getConfig', async () => {
    // 从数据库获取所有设置，并合并当前 process.env
    return { ...process.env, ...getAllSettings() };
  });

  ipcMain.handle('api:updateConfig', async (event, newConfig) => {
    try {
      Object.entries(newConfig).forEach(([key, value]) => {
        setSetting(key, value);
        process.env[key] = value;
      });

      // 如果更新了定时任务相关的配置，同步到 Windows 任务计划程序
      if (newConfig.SCHEDULE_ENABLED !== undefined || newConfig.SCHEDULE_TIME !== undefined) {
        const enabled = getSetting('SCHEDULE_ENABLED') === 'true' || getSetting('SCHEDULE_ENABLED') === true;
        const time = getSetting('SCHEDULE_TIME');
        scheduler.syncTask(enabled, time).catch(err => {
          console.error('[IPC] 同步 Windows 任务计划失败:', err);
        });
      }

      return { success: true };
    } catch (error) {
      throw new Error('更新配置失败: ' + error.message);
    }
  });

  ipcMain.handle('api:getEnvStatus', async () => {
    // 既然使用了 SQLite，配置总是在某种形式上“存在”的，
    // 或者我们可以返回是否有关键配置
    const settings = getAllSettings();
    const hasRequiredConfig = !!(settings.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY);
    return { exists: hasRequiredConfig };
  });

  ipcMain.handle('api:initEnv', async () => {
    // 现在主要使用 SQLite，初始化默认配置
    const defaultSettings = {
      BASE_REPO_DIR: '',
      DEEPSEEK_API_KEY: '',
      DEFAULT_USER: '',
      XUEXITONG_LOG_CHECK_URL: 'https://note.chaoxing.com/pc/index',
      XUEXITONG_USERNAME: '',
      XUEXITONG_PASSWORD: '',
      LAST_SELECTED_REPOS: '',
      FOOL_MODE_SELECTED_REPOS: '',
      BROWSER_PATH: '',
      NOTIFICATION_SOUND_ENABLED: 'true',
      SUCCESS_SOUND: 'yeah.mp3',
      FAILURE_SOUND: '啊咧？.mp3',
      SCHEDULE_ENABLED: 'false',
      SCHEDULE_TIME: '18:00',
      TITLE_TEMPLATE: '',
      EMAIL_ADDRESS: '',
      DAILY_EMAIL_ENABLED: 'false',
      WEEKLY_EMAIL_ENABLED: 'false'
    };

    try {
      Object.entries(defaultSettings).forEach(([key, value]) => {
        if (getSetting(key) === null) {
          setSetting(key, value);
          process.env[key] = value;
        }
      });
      return { success: true };
    } catch (error) {
      return { success: false, message: '初始化配置失败: ' + error.message };
    }
  });

  // 浏览器检测相关
  ipcMain.handle('api:detectBrowsers', async () => {
    const browsers = [];
    const commonPaths = {
      'Chrome': [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
      ],
      'Edge': [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ],
      'Firefox': [
        'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
        'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
      ]
    };

    for (const [name, paths] of Object.entries(commonPaths)) {
      for (const p of paths) {
        if (fs.existsSync(p)) {
          browsers.push({ name, path: p });
          break; // 找到一个路径即可
        }
      }
    }
    return browsers;
  });

  // 音效相关
  ipcMain.handle('api:listSounds', async () => {
    try {
      // 增加多种路径探测，确保在开发和生产环境下都能找到音效
      const possiblePaths = [
        path.join(__dirname, '../frontend/public/sound'),
        path.join(__dirname, '../frontend/dist/sound'),
        path.join(process.cwd(), 'frontend/public/sound'),
        path.join(process.cwd(), 'frontend/dist/sound')
      ];

      let soundDir = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          soundDir = p;
          break;
        }
      }

      if (!soundDir) {
        console.warn('未找到音效目录');
        return [];
      }

      const files = fs.readdirSync(soundDir);
      return files
        .filter(file => file.endsWith('.mp3'))
        .map(file => ({
          name: file,
          path: `sound/${file}` // 前端统一使用相对路径 ./sound/filename
        }));
    } catch (error) {
      console.error('获取音效列表失败:', error);
      return [];
    }
  });

  // Git 相关
  ipcMain.handle('api:getGitAuthors', async (event, { repoPaths }) => {
    const authors = await gitService.getAuthors(repoPaths);
    return { authors };
  });

  ipcMain.handle('api:getGitBranches', async (event, { repoPaths }) => {
    const branches = await gitService.getBranches(repoPaths);
    return { branches };
  });

  ipcMain.handle('api:getGitLogs', async (event, params) => {
    const { repoPaths, startDate, endDate, author, branches } = params;
    let allLogs = [];
    for (const repoPath of repoPaths) {
      try {
        const repoName = repoPath.replace(/[\\/]$/, '').split(/[\\/]/).pop();
        const repoBranches = branches[repoPath] || [];
        const logs = await gitService.getGitLogs(repoPath, startDate, endDate, author, repoBranches);
        allLogs.push(...logs.map(log => ({ ...log, repoName })));
      } catch (error) {
        console.error(`读取仓库 ${repoPath} 日志失败:`, error);
      }
    }
    // 按时间倒序排列
    allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { logs: allLogs };
  });

  // AI 相关
  ipcMain.handle('api:getTemplates', async () => {
    return templates;
  });

  ipcMain.handle('api:generateAiLog', async (event, data) => {
    const { logs, repoPaths, options } = data;
    
    // 构造 repoPathsMap (repoName -> path)
    const repoPathsMap = {};
    repoPaths.forEach(repoPath => {
      const repoName = repoPath.replace(/[\\/]$/, '').split(/[\\/]/).pop();
      repoPathsMap[repoName] = repoPath;
    });

    // 1. 自动对日志进行富化（获取 diffStat 和 diffContent）
    // 只有在开启了对应选项时才获取 diffContent 以节省资源
    const enrichedLogs = await gitService.enrichLogs(
      repoPathsMap, 
      logs, 
      options?.includeDiffContent || false
    );

    // 2. 调用 AI 生成
    return await aiService.generateAILog({
      ...data,
      logs: enrichedLogs,
      titleTemplate: getSetting('TITLE_TEMPLATE') || ''
    });
  });

  // AI 聊天助手相关
  ipcMain.handle('api:chatWithAssistant', async (event, data) => {
    return await aiService.chatWithAssistant({
      ...data,
      apiKey: getSetting('DEEPSEEK_API_KEY')
    });
  });

  ipcMain.handle('api:createXuexitongNote', async (event, { content, title, headless = false, silentNotify = false }) => {
    console.log(`[Backend] createXuexitongNote called. headless: ${headless}, silentNotify: ${silentNotify}`);

    // 获取通知图标的可靠路径
     const getNotifyIcon = () => {
       const png = path.resolve(__dirname, '../frontend/public/favicon.png');
       if (fs.existsSync(png)) return png;
       return undefined;
     };

    const targetUrl = process.env.XUEXITONG_LOG_CHECK_URL || 'https://note.chaoxing.com/pc/index';
    const username = process.env.XUEXITONG_USERNAME;
    const password = process.env.XUEXITONG_PASSWORD;
    const customBrowserPath = process.env.BROWSER_PATH;

    if (!username || !password) {
      throw new Error('未配置学习通账号密码，请在设置中配置后再试');
    }

    try {
      // 1. 启动或复用浏览器
      // 检查浏览器是否需要重启（路径变化、无头模式变化或已断开连接）
      const isConnected = browserContext && (browserInstance ? browserInstance.isConnected() : browserContext.browser()?.isConnected());
      const isPathChanged = lastUsedBrowserPath !== customBrowserPath;
      const isHeadlessChanged = lastUsedHeadless !== headless;

      if (!browserContext || !isConnected || isPathChanged || isHeadlessChanged) {
        console.log(`[Backend] ${isHeadlessChanged ? '无头模式切换' : (isPathChanged ? '路径更改' : '启动新实例')}, headless: ${headless}`);
        
        try {
          await closeBrowser();

          lastUsedBrowserPath = customBrowserPath; // 更新记录
          lastUsedHeadless = headless;           // 更新无头模式记录
          
          const launchOptions = {
            headless: !!headless, // 确保是布尔值
            viewport: { width: 1280, height: 800 },
            args: [
              '--disable-blink-features=AutomationControlled',
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--incognito' // 强制开启无痕模式
            ]
          };

          if (headless) {
            launchOptions.args.push('--headless=new');
          }

          // 如果用户指定了本地浏览器路径，则使用它
          if (customBrowserPath && fs.existsSync(customBrowserPath)) {
            console.log(`使用自定义浏览器路径: ${customBrowserPath}`);
            launchOptions.executablePath = customBrowserPath;
            
            browserInstance = await chromium.launch(launchOptions);
            browserContext = await browserInstance.newContext({
              viewport: { width: 1280, height: 800 }
            });
          } else {
            // 如果没指定，仍使用 Playwright 默认的持久化目录（作为兜底）
            const userDataDir = path.join(process.cwd(), 'playwright-data');
            if (!fs.existsSync(userDataDir)) {
              fs.mkdirSync(userDataDir, { recursive: true });
            }
            browserContext = await chromium.launchPersistentContext(userDataDir, launchOptions);
            browserInstance = browserContext.browser(); // 对于 persistent context, browser() 可能返回 null 或 浏览器对象
          }

          if (browserContext) {
            browserContext.on('close', () => {
              console.log('浏览器上下文已关闭');
              browserContext = null;
              browserInstance = null;
            });
          }
        } catch (launchError) {
          console.error('浏览器启动失败:', launchError);
          browserContext = null;
          throw new Error(`无法启动浏览器: ${launchError.message}。请检查路径配置是否正确。`);
        }
      }

      let page;
      try {
        page = await browserContext.newPage();
      } catch (pageError) {
        console.warn('创建页面失败，尝试重置上下文...', pageError);
        browserContext = null; // 标记为失效，下次重试
        throw new Error('浏览器会话已失效，请再次点击同步');
      }
      
      // 2. 访问学习通笔记页
      console.log('正在访问学习通笔记页面...');
      await page.goto(targetUrl, { waitUntil: 'load', timeout: 60000 });

      // 3. 登录检测与处理
      if (page.url().includes('login') || await page.$('input#phone')) {
        console.log('检测到需要登录，正在填充账号密码...');
        try {
          await page.fill('input#phone', username);
          await page.fill('input#pwd', password);
          await page.click('button#loginBtn');
          await page.waitForURL('**chaoxing.com/**', { timeout: 120000 });
          console.log('登录成功');
        } catch (loginError) {
          throw new Error('自动登录失败: ' + loginError.message);
        }
      }

      // 4. 确保进入笔记页面 (如果使用了工作日志 URL，通常已在对应页面)
      const isNotePage = page.url().includes('note.chaoxing.com') || page.url().includes('noteyd.chaoxing.com');
      
      if (!isNotePage) {
        console.log('未检测到笔记域名，尝试点击菜单或直接跳转...');
        const noteMenuSelector = 'div[name="笔记"]';
        try {
          const menuBtn = await page.waitForSelector(noteMenuSelector, { timeout: 5000 });
          if (menuBtn) {
            await menuBtn.click();
            await page.waitForTimeout(500);
          }
        } catch (e) {
          await page.goto(targetUrl, { waitUntil: 'load', timeout: 30000 });
        }
      }

      // 5. 点击“写笔记”按钮 - 优化：使用合并选择器快速查找
      const combinedSelector = 'a.jb_btn_104, a:has-text("写笔记"), a[href*="jumpToAddNote"], text=写笔记';
      
      let notePage = page;
      let foundNewBtn = false;

      const fastClick = async (frame) => {
        try {
          const btn = await frame.$(combinedSelector);
          if (btn) {
            console.log(`快速定位成功，正在进入写笔记页面...`);
            const [newPage] = await Promise.all([
              browserContext.waitForEvent('page', { timeout: 5000 }).catch(() => null),
              btn.click()
            ]);
            if (newPage) notePage = newPage;
            return true;
          }
        } catch (e) {}
        return false;
      };

      // 1. 尝试快速点击
      foundNewBtn = await fastClick(page);

      // 2. 如果没找到且不在笔记页，直接跳转（最快方式）
      if (!foundNewBtn && !page.url().includes('jumpToAddNote')) {
        console.log('正在执行极速跳转...');
        const currentUrl = page.url();
        const domain = currentUrl.includes('noteyd.chaoxing.com') ? 'noteyd.chaoxing.com' : 'note.chaoxing.com';
        const jumpUrl = `https://${domain}/pc/note_notebook/jumpToAddNote`;
        
        try {
          await page.goto(jumpUrl, { waitUntil: 'load', timeout: 20000 });
          // 跳转后检查是否真的到了编辑页
          await page.waitForTimeout(1000);
          if (page.url().includes('jumpToAddNote')) {
            foundNewBtn = true;
            notePage = page;
          } else {
            console.log('跳转被重定向，尝试在当前页面寻找“写笔记”按钮...');
            foundNewBtn = await fastClick(page);
          }
        } catch (gotoError) {
          if (gotoError.message.includes('net::ERR_ABORTED')) {
            console.warn('导航被中止 (ERR_ABORTED)，尝试在当前页面寻找“写笔记”按钮...');
            foundNewBtn = await fastClick(page);
          } else {
            throw gotoError;
          }
        }
      }

      // 如果最终还是没找到按钮也没进入编辑页，抛出明确错误
      if (!foundNewBtn && !notePage.url().includes('jumpToAddNote')) {
        console.log('正在尝试最后一次尝试：直接点击页面上的写笔记文本...');
        try {
          await page.click('text=写笔记', { timeout: 3000 });
          const [newPage] = await Promise.all([
            browserContext.waitForEvent('page', { timeout: 5000 }).catch(() => null),
            page.waitForTimeout(500)
          ]);
          if (newPage) notePage = newPage;
          foundNewBtn = true;
        } catch (e) {
          throw new Error('未能进入“写笔记”页面，请手动点击学习通页面上的“写笔记”按钮后再试');
        }
      }

      // 6. 切换笔记本逻辑 (针对编辑页)
      if (notePage.url().includes('jumpToAddNote') || notePage.url().includes('addNote')) {
        console.log('正在检查编辑页笔记本分类...');
        try {
          // 优化：不再强制等待 domcontentloaded，直接等待关键元素
          await notePage.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
          
          // 检查当前选中的笔记本名称
          const currentFolderSelector = '.nowFolder .foldername';
          const currentFolderEl = await notePage.waitForSelector(currentFolderSelector, { timeout: 8000 });
          const currentFolderName = await currentFolderEl?.innerText();
          
          console.log(`当前笔记本分类: ${currentFolderName}`);
          
          if (currentFolderName && !currentFolderName.includes('工作日志')) {
            console.log('检测到当前不是“工作日志”，正在尝试切换...');
            
            // 1. 点击切换按钮 (整个 .nowFolder 区域)
            await notePage.click('.nowFolder');
            
            // 2. 处理弹出的 iframe
            const iframeSelector = 'iframe#selectNoteFolder';
            const iframeElement = await notePage.waitForSelector(iframeSelector, { timeout: 5000 });
            const iframe = await iframeElement.contentFrame();
            
            if (iframe) {
              console.log('正在从选择框中查找“工作日志”...');
              const targetFolderSelector = '.notebook_item:has-text("工作日志")';
              await iframe.waitForSelector(targetFolderSelector, { timeout: 5000 });
              await iframe.click(targetFolderSelector);
              
              console.log('已点击“工作日志”，等待页面更新...');
              await notePage.waitForTimeout(1000);
            }
          }
        } catch (folderError) {
          console.warn('检查/切换笔记本失败:', folderError.message, '尝试继续同步...');
        }
      } else {
        console.warn('当前不在编辑页，跳过笔记本切换检查');
      }

      // 6. 填充标题和内容 - 优化：直接通过 JS 注入，并增加备选方案
      console.log('正在注入笔记内容...');
      await notePage.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
      
      // 等待编辑器主体加载，作为页面就绪的信号
      try {
        await notePage.waitForSelector('div[contenteditable="true"].ProseMirror', { timeout: 10000 });
      } catch (e) {
        console.warn('等待编辑器主体超时，尝试继续填充...');
      }

      // 填充标题的增强逻辑
      const fillTitle = async () => {
        const titleSelectors = ['#noteTitle', 'input[placeholder*="标题"]', '.note-title-input'];
        for (const selector of titleSelectors) {
          try {
            const el = await notePage.waitForSelector(selector, { timeout: 5000 });
            if (el) {
              await el.focus();
              await el.click(); // 显式点击以确保触发框架的 focus 事件
              
              // 使用 fill 后再手动触发一系列事件，确保框架感知到状态变化
              await el.fill(title);
              
              await el.evaluate(node => {
                // 触发 input 事件 (Vue/React 常用)
                node.dispatchEvent(new Event('input', { bubbles: true }));
                // 触发 change 事件
                node.dispatchEvent(new Event('change', { bubbles: true }));
                // 触发 blur 事件，很多框架在失去焦点时同步状态
                node.dispatchEvent(new Event('blur', { bubbles: true }));
              });
              
              console.log(`标题填充成功并触发事件 (使用选择器: ${selector})`);
              return true;
            }
          } catch (e) {
            continue;
          }
        }
        // 如果选择器都失败，尝试使用键盘
        try {
          console.warn('选择器填充标题失败，尝试模拟按键...');
          await notePage.focus('body'); 
          await notePage.keyboard.press('Tab'); 
          await notePage.keyboard.type(title, { delay: 10 });
          return true;
        } catch (e) {
          console.error('所有标题填充方案均失败:', e.message);
          return false;
        }
      };

      await fillTitle();
      
      // 填充内容
      try {
        const contentEl = await notePage.waitForSelector('div[contenteditable="true"].ProseMirror', { timeout: 5000 });
        if (contentEl) {
          await contentEl.evaluate((node, val) => {
            node.innerHTML = val;
            node.dispatchEvent(new Event('input', { bubbles: true }));
          }, marked.parse(content));
          console.log('内容注入成功');
        }
      } catch (e) {
        console.warn('编辑器内容注入失败，尝试模拟按键填充...');
        await notePage.keyboard.press('Tab');
        await notePage.keyboard.type(content, { delay: 0 });
      }

      // 在点击保存前稍微等待，确保框架已经处理完上面的事件
      await notePage.waitForTimeout(1000);

      // 7. 快速保存
      await notePage.click('#y-finish', { delay: 100 });
      console.log('同步指令已发出');

      // 等待保存完成或页面跳转，然后再结束（有助于连续同步时的稳定性）
      await notePage.waitForTimeout(1500);
      
      // 如果不是同一个页面，关闭新开的笔记页
      if (notePage !== page) {
        await notePage.close().catch(() => {});
      }
      // 关闭列表页
      await page.close().catch(() => {});

      if (!silentNotify) {
        new Notification({
          title: 'Git Log AI',
          body: `同步成功：${title}`,
          icon: getNotifyIcon()
        }).show();
      }

      return { success: true };
    } catch (error) {
      console.error('学习通同步失败:', error);
      throw new Error('同步失败: ' + error.message);
    }
  });

  // 系统通知相关
  ipcMain.handle('api:showNotification', async (event, data) => {
    try {
      // 获取通知图标的可靠路径
       const getNotifyIcon = () => {
         const png = path.resolve(__dirname, '../frontend/public/favicon.png');
         if (fs.existsSync(png)) return png;
         return undefined;
       };

      new Notification({ 
        title: data.title, 
        body: data.body, 
        silent: data.silent || false,
        icon: getNotifyIcon()
      }).show();
      return { success: true };
    } catch (err) {
      console.error('Notification Error:', err);
      return { success: false, error: err.message };
    }
  });

  // 开机自启相关
  ipcMain.handle('api:getAutoLaunch', async () => {
    try {
      const settings = app.getLoginItemSettings();
      return settings.openAtLogin;
    } catch (error) {
      console.error('获取开机自启状态失败:', error);
      return false;
    }
  });

  ipcMain.handle('api:setAutoLaunch', async (event, enable) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enable,
        path: process.execPath, // 显式指定可执行文件路径
      });
      return true;
    } catch (error) {
      console.error('设置开机自启失败:', error);
      return false;
    }
  });

  // 发送测试邮件
  ipcMain.handle('api:sendTestEmail', async (event, email) => {
    try {
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_NAME } = emailConfig;

      if (!SMTP_USER || !SMTP_PASS || SMTP_PASS === 'your_auth_code_here') {
        return { success: false, error: '请先在 backend/emailConfig.js 中配置正确的 SMTP 账号和授权码' };
      }

      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT),
        secure: parseInt(SMTP_PORT) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: `"${FROM_NAME}" <${SMTP_USER}>`,
        to: email,
        subject: 'Git Log Generator - 测试邮件',
        text: '这是一封来自 Git Log Generator 的测试邮件，证明您的邮件配置已生效。',
        html: '<p>这是一封来自 <b>Git Log Generator</b> 的测试邮件，证明您的邮件配置已生效。</p>'
      });

      return { success: true };
    } catch (error) {
      console.error('发送测试邮件失败:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * 清理资源（如关闭浏览器）
 */
async function cleanup() {
  if (browserContext) {
    console.log('正在关闭浏览器实例...');
    try {
      // 加上超时，防止关闭过程卡死导致应用无法退出
      await Promise.race([
        browserContext.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      browserContext = null;
    } catch (e) {
      console.error('关闭浏览器失败或超时:', e);
      browserContext = null; // 无论如何都清空引用
    }
  }
}

module.exports = { registerIpcHandlers, cleanup };
