const { ipcMain, Notification } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { marked } = require('marked');

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
});
const gitService = require('./server/services/gitService');
const aiService = require('./server/services/aiService');
const { templates } = require('./server/constants/templates');
const { getSetting, setSetting, getAllSettings } = require('./database');

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
      XUEXITONG_NOTE_URL: 'https://note.chaoxing.com/pc/index',
      XUEXITONG_USERNAME: '',
      XUEXITONG_PASSWORD: '',
      LAST_SELECTED_REPOS: '',
      FOOL_MODE_SELECTED_REPOS: '',
      BROWSER_PATH: '',
      NOTIFICATION_SOUND_ENABLED: 'true',
      SUCCESS_SOUND: 'yeah.mp3',
      FAILURE_SOUND: '啊咧？.mp3',
      SCHEDULE_ENABLED: 'false',
      SCHEDULE_TIME: '18:00'
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
      logs: enrichedLogs
    });
  });

  // 学习通同步相关
  ipcMain.handle('api:createXuexitongNote', async (event, { content, title, headless = false }) => {
    console.log(`[Backend] createXuexitongNote called. headless: ${headless}, lastUsedHeadless: ${lastUsedHeadless}`);

    // 获取通知图标的可靠路径
     const getNotifyIcon = () => {
       const png = path.resolve(__dirname, '../frontend/public/favicon.png');
       if (fs.existsSync(png)) return png;
       return undefined;
     };

    const targetUrl = process.env.XUEXITONG_NOTE_URL || 'https://note.chaoxing.com/pc/index';
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

      // 4. 确保进入笔记页面
      const noteMenuSelector = 'div[name="笔记"]';
      const isNotePage = page.url().includes('note.chaoxing.com/pc/index') || page.url().includes('noteyd.chaoxing.com/pc/index');
      
      if (!isNotePage) {
        try {
          const menuBtn = await page.waitForSelector(noteMenuSelector, { timeout: 8000 });
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
        await page.goto('https://noteyd.chaoxing.com/pc/note_notebook/jumpToAddNote', { waitUntil: 'domcontentloaded' });
        foundNewBtn = true;
        notePage = page;
      }

      // 6. 填充标题和内容 - 优化：直接通过 JS 注入，不再模拟打字
      console.log('正在注入笔记内容...');
      await notePage.waitForLoadState('domcontentloaded');
      
      await Promise.all([
        // 填充标题
        notePage.waitForSelector('#noteTitle', { timeout: 5000 }).then(el => 
          el.evaluate((node, val) => {
            node.value = val;
            node.dispatchEvent(new Event('input', { bubbles: true }));
          }, title)
        ).catch(e => console.warn('标题填充跳过:', e.message)),

        // 填充内容
        notePage.waitForSelector('div[contenteditable="true"].ProseMirror', { timeout: 5000 }).then(el =>
          el.evaluate((node, val) => {
            node.innerHTML = val;
            node.dispatchEvent(new Event('input', { bubbles: true }));
          }, marked.parse(content))
        ).catch(async () => {
          // 备选方案：如果找不到编辑器，尝试 Tab 键快速填充
          await notePage.keyboard.press('Tab');
          await notePage.keyboard.type(content, { delay: 0 });
        })
      ]);

      // 7. 快速保存
      await notePage.click('#y-finish', { delay: 0 });
      console.log('同步指令已发出');

      new Notification({
        title: 'Git Log AI',
        body: `同步成功：${title}`,
        icon: getNotifyIcon()
      }).show();

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
