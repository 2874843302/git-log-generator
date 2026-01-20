const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// API: 获取系统盘符 (Windows 特有)
router.get('/drives', (req, res) => {
    if (process.platform === 'win32') {
        exec('wmic logicaldisk get name', (error, stdout) => {
            if (error) {
                return res.json({ drives: ['C:/'] });
            }
            const drives = stdout.split('\r\n')
                .filter(value => /[A-Za-z]:/.test(value))
                .map(value => value.trim() + '/');
            res.json({ drives });
        });
    } else {
        res.json({ drives: ['/'] });
    }
});

// API: 列出指定目录下的文件夹
router.get('/list-dir', (req, res) => {
    let currentPath = req.query.path || process.env.BASE_REPO_DIR || process.cwd();
    
    // 统一路径分隔符
    currentPath = path.resolve(currentPath).replace(/\\/g, '/');
    if (!currentPath.endsWith('/')) currentPath += '/';

    try {
        const files = fs.readdirSync(currentPath, { withFileTypes: true });
        const folders = files
            .filter(file => file.isDirectory())
            .map(folder => folder.name)
            .sort((a, b) => a.localeCompare(b));

        res.json({
            currentPath,
            parentPath: path.dirname(currentPath.replace(/\/$/, '')).replace(/\\/g, '/') + '/',
            folders
        });
    } catch (error) {
        res.status(500).json({ error: '无法读取目录: ' + error.message });
    }
});

// API: 获取当前配置的基础目录
router.get('/base-dir', (req, res) => {
    res.json({ path: process.env.BASE_REPO_DIR || '' });
});

// API: 更新配置并写入 .env 文件
router.post('/config', (req, res) => {
    const { key, value } = req.body;
    if (!key) {
        return res.status(400).json({ error: 'Key 不能为空' });
    }

    try {
        const envPath = path.join(__dirname, '../../.env');
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        const configLine = `${key}=${value || ''}`;
        const regex = new RegExp(`^${key}=.*$`, 'm');
        
        if (envContent.match(regex)) {
            // 替换现有行
            envContent = envContent.replace(regex, configLine);
        } else {
            // 追加到末尾
            envContent += (envContent.endsWith('\n') ? '' : '\n') + configLine + '\n';
        }

        fs.writeFileSync(envPath, envContent, 'utf8');
        
        // 同步更新当前运行环境的变量
        process.env[key] = value;
        
        res.json({ success: true, key, value });
    } catch (error) {
        console.error(`更新配置 ${key} 失败:`, error);
        res.status(500).json({ error: `保存配置失败: ${error.message}` });
    }
});

// API: 获取配置信息 (安全过滤敏感信息)
router.get('/config', (req, res) => {
    res.json({
        BASE_REPO_DIR: process.env.BASE_REPO_DIR || '',
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
        DEFAULT_USER: process.env.DEFAULT_USER || ''
    });
});

/**
 * API: 列出基础目录下的所有 Git 仓库
 * 用于“傻瓜模式”快速选择
 */
router.get('/git-repos', (req, res) => {
    const baseDir = process.env.BASE_REPO_DIR;
    if (!baseDir) {
        return res.status(400).json({ error: '未配置基础工作目录，请先在设置中配置' });
    }

    try {
        if (!fs.existsSync(baseDir)) {
            return res.status(400).json({ error: '配置的基础目录不存在' });
        }

        const folders = fs.readdirSync(baseDir, { withFileTypes: true });
        const gitRepos = folders
            .filter(dirent => {
                if (!dirent.isDirectory()) return false;
                const fullPath = path.join(baseDir, dirent.name);
                // 检查目录下是否存在 .git 文件夹
                return fs.existsSync(path.join(fullPath, '.git'));
            })
            .map(dirent => ({
                name: dirent.name,
                path: path.join(baseDir, dirent.name).replace(/\\/g, '/')
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ repos: gitRepos, baseDir });
    } catch (error) {
        console.error('列出 Git 仓库失败:', error);
        res.status(500).json({ error: '读取基础目录失败: ' + error.message });
    }
});

// API: 更新基础目录并写入 .env 文件
router.post('/base-dir', (req, res) => {
    const { path: newPath } = req.body;
    if (newPath === undefined) {
        return res.status(400).json({ error: '路径不能为空' });
    }

    try {
        const envPath = path.join(__dirname, '../../.env');
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        const baseDirLine = `BASE_REPO_DIR=${newPath}`;
        
        if (envContent.includes('BASE_REPO_DIR=')) {
            // 替换现有行
            envContent = envContent.replace(/^BASE_REPO_DIR=.*$/m, baseDirLine);
        } else {
            // 追加到末尾
            envContent += (envContent.endsWith('\n') ? '' : '\n') + baseDirLine + '\n';
        }

        fs.writeFileSync(envPath, envContent, 'utf8');
        
        // 同步更新当前运行环境的变量
        process.env.BASE_REPO_DIR = newPath;
        
        res.json({ success: true, path: newPath });
    } catch (error) {
        console.error('更新 .env 失败:', error);
        res.status(500).json({ error: '保存基础目录失败: ' + error.message });
    }
});

// API: 选择本地文件夹 (仅限 Windows)
router.get('/select-folder', (req, res) => {
    const baseDir = process.env.BASE_REPO_DIR || '';
    // 如果配置了基础目录，则在 PowerShell 中设置 SelectedPath 为该目录
    const initialDirScript = baseDir ? `$f.SelectedPath = '${baseDir.replace(/'/g, "''")}';` : '';
    
    const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '请选择 Git 仓库目录'; ${initialDirScript} if($f.ShowDialog() -eq 'OK') { $f.SelectedPath }"`;
    
    exec(command, (error, stdout) => {
        if (error) {
            return res.status(500).json({ error: '无法打开文件夹对话框' });
        }
        const selectedPath = stdout.trim();
        res.json({ path: selectedPath });
    });
});

module.exports = router;
