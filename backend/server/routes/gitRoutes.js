const express = require('express');
const router = express.Router();
const gitService = require('../services/gitService');

// API: 获取仓库所有作者
router.post('/git-authors', async (req, res) => {
    const { repoPaths } = req.body;
    if (!repoPaths || !Array.isArray(repoPaths) || repoPaths.length === 0) {
        return res.status(400).json({ error: '请提供有效的仓库路径列表' });
    }

    try {
        const authors = await gitService.getAuthors(repoPaths);
        res.json({ authors });
    } catch (error) {
        res.status(500).json({ error: '获取作者列表失败: ' + error.message });
    }
});

// API: 获取 Git 记录
router.post('/git-logs', async (req, res) => {
    const { repoPaths, startDate, endDate, author } = req.body;
    if (!repoPaths || !Array.isArray(repoPaths) || repoPaths.length === 0) {
        return res.status(400).json({ error: '请提供有效的仓库路径列表' });
    }

    try {
        let allLogs = [];
        for (const path of repoPaths) {
            const repoName = path.split(/[\\/]/).pop();
            const logs = await gitService.getGitLogs(path, startDate, endDate, author);
            const taggedLogs = logs.map(l => ({ ...l, repoName }));
            allLogs = allLogs.concat(taggedLogs);
        }
        allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ logs: allLogs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
