const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const gitService = require('../services/gitService');
const { templates } = require('../constants/templates');

// API: 生成 AI 日志
router.post('/generate-log', async (req, res) => {
    const { logs, templateKey, customPrompt, options, repoPaths } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
        return res.status(400).json({ error: '请在 .env 文件中配置有效的 DEEPSEEK_API_KEY' });
    }

    if (!logs || logs.length === 0) {
        return res.status(400).json({ error: '没有可供分析的提交记录' });
    }

    try {
        // 1. 数据准备：如果开启了深度分析，则获取详细的变更信息
        let enrichedLogs = logs;
        if (options?.includeDiffContent || options?.includeStats) {
            const repoPathsMap = {};
            if (repoPaths && Array.isArray(repoPaths)) {
                repoPaths.forEach(p => {
                    const name = p.split(/[\\/]/).pop();
                    repoPathsMap[name] = p;
                });
            }
            enrichedLogs = await gitService.enrichLogs(repoPathsMap, logs, options.includeDiffContent);
        }

        // 2. 调用 AI 服务生成内容
        const content = await aiService.generateAILog({
            logs: enrichedLogs,
            templateKey,
            customPrompt,
            options,
            repoPaths,
            apiKey
        });

        res.json({ content });
    } catch (error) {
        console.error('AI 生成失败:', error.response?.data || error.message);
        res.status(500).json({ error: 'AI 生成日志失败，请检查 API 配置或网络' });
    }
});

// API: 获取所有模版
router.get('/templates', (req, res) => {
    res.json(templates);
});

module.exports = router;
