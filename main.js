const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');

// 设置应用名称（用于通知显示等）
app.name = 'Git Log Generator';
// 设置 Windows 的 AppUserModelId 以确保通知能正确关联图标和名称
if (process.platform === 'win32') {
    app.setAppUserModelId('com.gitlog.generator');
}

require('dotenv').config(); // 加载环境变量

// 图标路径 - 增加多种路径探测以确保兼容性
const getIconPath = () => {
    // 强制使用最可靠的绝对路径
    const baseDir = __dirname;
    const paths = [
        path.join(baseDir, 'frontend/public/favicon.png'),
        path.join(baseDir, 'frontend/dist/favicon.png'),
        path.join(baseDir, 'favicon.png'),
        path.join(process.cwd(), 'frontend/public/favicon.png')
    ];
    for (const p of paths) {
        const absolutePath = path.resolve(p);
        if (require('fs').existsSync(absolutePath)) {
            console.log('找到图标文件:', absolutePath);
            return absolutePath;
        }
    }
    return path.resolve(baseDir, 'frontend/public/favicon.png');
};

const iconPath = getIconPath();
let appIcon = nativeImage.createFromPath(iconPath);

if (appIcon.isEmpty()) {
    console.error('nativeImage 无法加载任何图标文件');
}

// 1. 判定开发环境
const isDev = !app.isPackaged;

// 保持对窗口对象的全局引用
let mainWindow;

/**
 * 创建 Electron 窗口
 */
function createWindow() {
    // 检查图标是否存在
    console.log('正在创建窗口，图标路径:', iconPath);
    
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        show: false, // 初始不显示，防止白屏
        backgroundColor: '#ffffff', // 设置背景色，使显示更平滑
        icon: iconPath, 
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        title: 'Git Log Generator',
    });

    // 如果 nativeImage 成功加载了对象，则补充调用 setIcon
    if (appIcon && !appIcon.isEmpty()) {
        try {
            mainWindow.setIcon(appIcon);
        } catch (e) {
            console.error('setIcon 失败:', e);
        }
    }

    // 根据开发环境或生产环境加载 URL
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // 开发环境下打开开发者工具
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
    }

    // 优雅显示：等页面准备好后再显示窗口，解决白屏问题
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 当 Electron 初始化完成并准备好创建浏览器窗口时调用
app.whenReady().then(() => {
    // 初始化数据库
    const { initDatabase } = require('./backend/database');
    initDatabase(app.getPath('userData'));

    // 注册 IPC 处理函数
    const { registerIpcHandlers } = require('./backend/ipcHandlers');
    registerIpcHandlers();
    
    createWindow();

    // 初始化更新程序
    const { initUpdater } = require('./updater');
    initUpdater(mainWindow);

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', async () => {
    console.log('所有窗口已关闭，正在执行清理并退出...');
    const { cleanup } = require('./backend/ipcHandlers');
    await cleanup();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 在应用退出前确保清理
app.on('will-quit', async () => {
    const { cleanup } = require('./backend/ipcHandlers');
    await cleanup();
});

app.on('quit', () => {
    console.log('应用已完全退出');
    process.exit(0); // 强制结束进程
});
