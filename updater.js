const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');

// 配置日志
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// 关键：禁止自动下载，交给用户决定
autoUpdater.autoDownload = false;

// 1. 监听更新事件并发送给前端
function initUpdater(mainWindow) {
  if (!mainWindow) return;

  // 检查更新出错
  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-error', err.message);
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
  
  // 前端请求检查更新
  ipcMain.on('check-for-update', () => {
    // 开发环境下通常跳过更新检查，除非设置了 forceDevUpdateConfig
    if (process.env.NODE_ENV === 'development') {
      console.log('开发环境：模拟检查更新...');
      // 仅用于测试 UI
      // setTimeout(() => {
      //   mainWindow.webContents.send('update-available', { version: '9.9.9', releaseNotes: '测试更新' });
      // }, 1000);
      return;
    }
    autoUpdater.checkForUpdates();
  });

  // 前端请求开始下载
  ipcMain.on('start-download-update', () => {
    autoUpdater.downloadUpdate();
  });

  // 前端请求退出并安装
  ipcMain.on('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });
}

module.exports = { initUpdater };
