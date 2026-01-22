const { ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const gitService = require('./server/services/gitService');
const aiService = require('./server/services/aiService');
const { templates } = require('./server/constants/templates');

// Playwright 浏览器实例单例，避免重复启动
let browserContext = null;

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
    const envPath = path.join(process.cwd(), '.env');
    let config = { ...process.env };
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      lines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          config[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
      });
    }
    return config;
  });

  ipcMain.handle('api:updateConfig', async (event, newConfig) => {
    try {
      const envPath = path.join(process.cwd(), '.env');
      let currentEnv = '';
      if (fs.existsSync(envPath)) {
        currentEnv = fs.readFileSync(envPath, 'utf8');
      }

      let envLines = currentEnv.split('\n');
      Object.entries(newConfig).forEach(([key, value]) => {
        const index = envLines.findIndex(line => line.startsWith(`${key}=`));
        if (index > -1) {
          envLines[index] = `${key}=${value}`;
        } else {
          envLines.push(`${key}=${value}`);
        }
        process.env[key] = value;
      });

      fs.writeFileSync(envPath, envLines.join('\n').trim() + '\n');
      return { success: true };
    } catch (error) {
      throw new Error('更新配置失败: ' + error.message);
    }
  });

  ipcMain.handle('api:getEnvStatus', async () => {
    const envPath = path.join(process.cwd(), '.env');
    return { exists: fs.existsSync(envPath) };
  });

  ipcMain.handle('api:initEnv', async () => {
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      const template = 'BASE_REPO_DIR=\nDEEPSEEK_API_KEY=\nDEFAULT_USER=\nXUEXITONG_NOTE_URL=https://note.chaoxing.com/pc/index\nXUEXITONG_USERNAME=\nXUEXITONG_PASSWORD=\n';
      fs.writeFileSync(envPath, template);
      return { success: true };
    }
    return { success: false, message: '环境文件已存在' };
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
  ipcMain.handle('api:createXuexitongNote', async (event, { content, title }) => {
    const targetUrl = process.env.XUEXITONG_NOTE_URL || 'https://note.chaoxing.com/pc/index';
    const username = process.env.XUEXITONG_USERNAME;
    const password = process.env.XUEXITONG_PASSWORD;

    if (!username || !password) {
      throw new Error('未配置学习通账号密码，请在设置中配置后再试');
    }

    try {
      // 1. 启动或复用浏览器
      if (!browserContext || !browserContext.browser()?.isConnected()) {
        console.log('正在启动或重新连接浏览器...');
        const userDataDir = path.join(process.cwd(), 'playwright-data');
        if (!fs.existsSync(userDataDir)) {
          fs.mkdirSync(userDataDir, { recursive: true });
        }
        
        try {
          // 如果旧的上下文存在但已失效，先尝试关闭（不报错）
          if (browserContext) {
            await browserContext.close().catch(() => {});
          }

          browserContext = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            viewport: { width: 1280, height: 800 },
            args: [
              '--disable-blink-features=AutomationControlled',
              '--no-sandbox',
              '--disable-setuid-sandbox'
            ]
          });

          // 监听关闭事件，清理引用
          browserContext.on('close', () => {
            console.log('浏览器上下文已关闭');
            browserContext = null;
          });
        } catch (launchError) {
          console.error('浏览器启动失败:', launchError);
          browserContext = null;
          throw new Error('无法启动浏览器，请检查是否有其他实例正在运行');
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
            node.innerHTML = `<p>${val.replace(/\n/g, '</p><p>')}</p>`;
            node.dispatchEvent(new Event('input', { bubbles: true }));
          }, content)
        ).catch(async () => {
          // 备选方案：如果找不到编辑器，尝试 Tab 键快速填充
          await notePage.keyboard.press('Tab');
          await notePage.keyboard.type(content, { delay: 0 });
        })
      ]);

      // 7. 快速保存
      await notePage.click('#y-finish', { delay: 0 });
      console.log('同步指令已发出');

      return { success: true };
    } catch (error) {
      console.error('学习通同步失败:', error);
      throw new Error('同步失败: ' + error.message);
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
      await browserContext.close();
      browserContext = null;
    } catch (e) {
      console.error('关闭浏览器失败:', e);
    }
  }
}

module.exports = { registerIpcHandlers, cleanup };
