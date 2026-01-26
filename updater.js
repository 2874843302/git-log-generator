const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');

// 配置日志
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// 关键：禁止自动下载，交给用户决定
autoUpdater.autoDownload = false;

// 开发环境下强制开启更新检查逻辑
if (process.env.NODE_ENV === 'development') {
  autoUpdater.forceDevUpdateConfig = true;
}

// 1. 监听更新事件并发送给前端
function initUpdater(mainWindow) {
  if (!mainWindow) return;

  // 检查更新出错
  autoUpdater.on('error', (err) => {
    let friendlyMessage = err.message;
    
    // 针对常见的网络错误进行翻译和友好化
    if (err.message.includes('ERR_CONNECTION_TIMED_OUT')) {
      friendlyMessage = '检查更新超时，请检查网络连接或尝试使用代理';
    } else if (err.message.includes('ERR_NAME_NOT_RESOLVED')) {
      friendlyMessage = '无法解析更新服务器地址，请检查 DNS 设置';
    } else if (err.message.includes('ERR_INTERNET_DISCONNECTED')) {
      friendlyMessage = '网络连接已断开，请检查您的网络设置';
    } else if (err.message.includes('ERR_CONNECTION_REFUSED')) {
      friendlyMessage = '连接被拒绝，可能是服务器维护中或网络受到限制';
    } else if (err.message.includes('404')) {
      friendlyMessage = '未在服务器上找到更新版本信息';
    }

    mainWindow.webContents.send('update-error', friendlyMessage);
  });

  // 正在检查更新
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('checking-for-update');
  });

  // 发现新版本
  autoUpdater.on('update-available', (info) => {
    // info 包含 version, releaseNotes 等
    mainWindow.webContents.send('update-available', info);
  });

  // 当前已是最新
  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-not-available');
  });

  // 下载进度
  autoUpdater.on('download-progress', (progressObj) => {
    // progressObj 包含 bytesPerSecond, percent, transferred, total
    mainWindow.webContents.send('download-progress', progressObj);
  });

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', info);
  });

  // 2. 注册 IPC 监听前端指令
  
  const safeCheckForUpdates = () => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('检查更新失败:', err.message);
      // 注意：autoUpdater 会触发 'error' 事件，所以这里不需要额外发送 IPC
    });
  };

  // 前端请求检查更新
  ipcMain.on('check-for-update', () => {
    safeCheckForUpdates();
  });

  // 3. 自动检查更新
  // 应用启动后立即检查更新
  setTimeout(() => {
    safeCheckForUpdates();
  }, 0);

  // 前端请求开始下载
  ipcMain.on('start-download-update', () => {
    autoUpdater.downloadUpdate().catch(err => {
      console.error('下载更新失败:', err.message);
    });
  });

  // 前端请求退出并安装
  ipcMain.on('quit-and-install', () => {
    try {
      autoUpdater.quitAndInstall();
    } catch (err) {
      console.error('退出并安装失败:', err.message);
    }
  });
}

module.exports = { initUpdater };
