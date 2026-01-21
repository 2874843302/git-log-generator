const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// 判定开发环境
const isDev = !app.isPackaged;

// 保持对窗口对象的全局引用，避免 JavaScript 对象被垃圾回收时窗口关闭
let mainWindow;
let backendProcess;

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

/**
 * 启动后端 Express 服务
 */
function startBackend() {
    console.log('正在启动后端服务...');
    
    // 获取后端路径，处理 ASAR 环境
    let backendDir = path.join(__dirname, 'backend');
    if (__dirname.includes('app.asar')) {
        backendDir = backendDir.replace('app.asar', 'app.asar.unpacked');
    }
    
    const backendPath = path.join(backendDir, 'server/index.js');
    
    backendProcess = spawn('node', [backendPath], {
        cwd: backendDir,
        env: { ...process.env, PORT: 3001 },
        shell: true
    });

    backendProcess.stdout.on('data', (data) => {
        console.log(`[Backend]: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error]: ${data}`);
    });

    backendProcess.on('close', (code) => {
        console.log(`后端进程退出，退出码: ${code}`);
    });
}

// 当 Electron 初始化完成并准备好创建浏览器窗口时调用
app.whenReady().then(() => {
    startBackend();
    createWindow();

    app.on('activate', () => {
        // 在 macOS 上，当点击 dock 图标并且没有其他窗口打开时，通常会重新创建一个窗口
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 除了 macOS 外，当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (backendProcess) {
            backendProcess.kill();
        }
        app.quit();
    }
});

// 在应用退出前确保关闭后端进程
app.on('quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});
