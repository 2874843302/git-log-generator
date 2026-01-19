const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * 初始化环境：复制 .env.example 为 .env
 */
router.post('/init-env', async (req, res) => {
    try {
        const rootDir = path.join(__dirname, '../../..');
        const backendDir = path.join(rootDir, 'backend');
        const frontendDir = path.join(rootDir, 'frontend');

        const results = [];

        // 处理后端 .env
        const backendExample = path.join(backendDir, '.env.example');
        const backendEnv = path.join(backendDir, '.env');
        if (fs.existsSync(backendExample)) {
            if (!fs.existsSync(backendEnv)) {
                fs.copyFileSync(backendExample, backendEnv);
                results.push('后端 .env 创建成功');
            } else {
                results.push('后端 .env 已存在，跳过');
            }
        }

        // 处理前端 .env
        const frontendExample = path.join(frontendDir, '.env.example');
        const frontendEnv = path.join(frontendDir, '.env');
        if (fs.existsSync(frontendExample)) {
            if (!fs.existsSync(frontendEnv)) {
                fs.copyFileSync(frontendExample, frontendEnv);
                results.push('前端 .env 创建成功');
            } else {
                results.push('前端 .env 已存在，跳过');
            }
        }

        if (results.length === 0) {
            return res.status(404).json({ message: '未找到 .env.example 文件' });
        }

        res.json({ message: '环境初始化完成', details: results });
    } catch (error) {
        console.error('初始化环境失败:', error);
        res.status(500).json({ error: '初始化环境失败', message: error.message });
    }
});

/**
 * 检查环境状态
 */
router.get('/env-status', (req, res) => {
    const rootDir = path.join(__dirname, '../../..');
    const backendEnv = path.join(rootDir, 'backend', '.env');
    const frontendEnv = path.join(rootDir, 'frontend', '.env');

    res.json({
        backend: fs.existsSync(backendEnv),
        frontend: fs.existsSync(frontendEnv)
    });
});

module.exports = router;
