const { app, BrowserWindow } = require('electron');
const path = require('path');
require('dotenv').config(); // 加载环境变量
const { registerIpcHandlers, cleanup } = require('./backend/ipcHandlers');

// 判定开发环境
const isDev = !app.isPackaged;

// 保持对窗口对象的全局引用
let mainWindow;

/**
 * 创建 Electron 窗口
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        title: 'Git Log Generator',
    });

    // 根据开发环境或生产环境加载 URL
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // 开发环境下打开开发者工具
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 当 Electron 初始化完成并准备好创建浏览器窗口时调用
app.whenReady().then(() => {
    // 注册 IPC 处理函数替代 Express 后端
    registerIpcHandlers();
    
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', async () => {
    console.log('所有窗口已关闭，正在执行清理并退出...');
    await cleanup();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 在应用退出前确保清理
app.on('will-quit', async () => {
    await cleanup();
});

app.on('quit', () => {
    console.log('应用已完全退出');
    process.exit(0); // 强制结束进程
});
