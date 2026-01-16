const express = require('express');
const simpleGit = require('simple-git');
const axios = require('axios');
const cors = require('cors');
const dayjs = require('dayjs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 默认模版基础定义 (仅定义角色和核心任务，具体板块由 options 动态控制)
const templates = {
    daily: "作为一名软件工程师，请根据以下 Git 提交记录生成一份专业的日报。主要任务是汇总今日完成的工作。使用 Markdown 格式。",
    weekly: "请根据以下 Git 提交记录生成一份本周工作周报。主要任务是汇总本周主要成就和项目进展。使用 Markdown 格式。",
    technical: "请根据以下 Git 提交记录生成一份技术总结。主要任务是汇总技术架构变动和核心逻辑优化。使用 Markdown 格式。",
    release: "请根据以下 Git 提交记录生成一份正式的版本发布公告（Release Notes）。主要任务是列出新功能、优化和修复。使用 Markdown 格式。",
    kpi: "请根据以下 Git 提交记录生成一份绩效评估自述。主要任务是突出对业务和技术的关键贡献。使用 Markdown 格式。",
    concise: "请根据以下 Git 提交记录生成一份极简工作总结。用最精炼的语言列出主要事项。使用 Markdown 格式。",
    humorous: "请根据以下 Git 提交记录生成一份带有幽默感的程序员工作日志。在真实汇总工作的同时，加入一些程序员梗。使用 Markdown 格式。"
};

/**
 * 获取 Git 提交记录
 * @param {string} repoPath 仓库路径
 * @param {string} startDate 开始日期 (YYYY-MM-DD)
 * @param {string} endDate 结束日期 (YYYY-MM-DD)
 * @param {string} author 作者名 (可选)
 */
async function getGitLogs(repoPath, startDate, endDate, author) {
    const git = simpleGit(repoPath);
    const options = {
        '--after': startDate ? `${startDate} 00:00:00` : undefined,
        '--before': endDate ? `${endDate} 23:59:59` : undefined,
        '--author': author || undefined,
    };

    // 过滤掉 undefined 的选项
    const filteredOptions = Object.fromEntries(
        Object.entries(options).filter(([_, v]) => v !== undefined)
    );

    try {
        const logs = await git.log(filteredOptions);
        return logs.all;
    } catch (error) {
        throw new Error(`无法读取 Git 记录: ${error.message}`);
    }
}

// API: 选择本地文件夹 (仅限 Windows)
app.get('/api/select-folder', (req, res) => {
    const { exec } = require('child_process');
    const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '请选择 Git 仓库目录'; if($f.ShowDialog() -eq 'OK') { $f.SelectedPath }"`;
    
    exec(command, (error, stdout) => {
        if (error) {
            return res.status(500).json({ error: '无法打开文件夹对话框' });
        }
        const selectedPath = stdout.trim();
        res.json({ path: selectedPath });
    });
});

// API: 获取仓库所有作者 (支持多个路径)
app.post('/api/git-authors', async (req, res) => {
    const { repoPaths } = req.body;
    if (!repoPaths || !Array.isArray(repoPaths) || repoPaths.length === 0) {
        return res.status(400).json({ error: '请提供有效的仓库路径列表' });
    }

    try {
        let allAuthors = new Set();
        for (const path of repoPaths) {
            const git = simpleGit(path);
            const result = await git.raw(['log', '--format=%an']);
            result.split('\n').forEach(a => {
                const name = a.trim();
                if (name) allAuthors.add(name);
            });
        }
        res.json({ authors: Array.from(allAuthors) });
    } catch (error) {
        res.status(500).json({ error: '获取作者列表失败: ' + error.message });
    }
});

// API: 获取 Git 记录 (支持多个路径)
app.post('/api/git-logs', async (req, res) => {
    const { repoPaths, startDate, endDate, author } = req.body;
    if (!repoPaths || !Array.isArray(repoPaths) || repoPaths.length === 0) {
        return res.status(400).json({ error: '请提供有效的仓库路径列表' });
    }

    try {
        let allLogs = [];
        for (const path of repoPaths) {
            const repoName = path.split(/[\\/]/).pop();
            const logs = await getGitLogs(path, startDate, endDate, author);
            // 标记记录所属的项目
            const taggedLogs = logs.map(l => ({ ...l, repoName }));
            allLogs = allLogs.concat(taggedLogs);
        }
        // 按时间倒序排列
        allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ logs: allLogs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: 生成 AI 日志
app.post('/api/generate-log', async (req, res) => {
    const { logs, templateKey, customPrompt, options } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
        return res.status(400).json({ error: '请在 .env 文件中配置有效的 DEEPSEEK_API_KEY' });
    }

    if (!logs || logs.length === 0) {
        return res.status(400).json({ error: '没有可供分析的提交记录' });
    }

    let templatePrompt = templates[templateKey] || templates.daily;

    // 根据选项动态调整 prompt
    if (options) {
        const requirements = [];
        if (options.includeProblems) {
            requirements.push("【遇到的问题及解决方法】：分析提交记录中的 bug 修复或困难点，并总结解决方法。");
        }
        if (options.includeReflections) {
            requirements.push("【心得收获与技术感悟】：基于今日的代码变动，总结深层的技术思考、架构优化的意义或开发过程中的经验教训。");
        }
        if (options.includeTomorrow) {
            requirements.push("【明日计划】：根据今日工作进度，合理规划接下来的开发任务。");
        }
        
        if (requirements.length > 0) {
            templatePrompt += `\n请在生成的日志中，**严格按照以下顺序**包含这些板块：\n1. 今日完成工作（基于 Git 记录）\n${requirements.map((r, i) => `${i + 2}. ${r}`).join('\n')}`;
        } else {
            templatePrompt += `\n请仅对今日工作内容进行分类汇总，**禁止**出现明日计划、心得感悟或问题总结等其他板块。`;
        }
    }

    templatePrompt += `\n\n**严格遵循以下规范**：
1. **内容深度与润色**：
   - 对“今日完成工作”进行专业化润色。例如，不要只写“修复登录Bug”，而应写“优化登录模块，修复了特定场景下的身份验证异常，提升了系统的稳定性”。
   - 深入挖掘提交记录背后的意义，使用“重构”、“优化”、“增强”、“适配”等专业动词。
   - **严禁编造**：所有描述必须基于提供的 Git 记录，可以扩展其影响和意义，但不能凭空创造从未发生的工作任务。

2. **列表编号规则（强制执行）**：
   - 采用多级嵌套结构。父级使用有序列表（1. 2. 3.）。
   - **子级必须重置编号**：父级项下的子项必须重新从 1. 开始（如：1. -> 1.1 或 1. -> 嵌套的 1.）。
   - 如果 Markdown 渲染容易出错，请在子级使用无序列表（ - ）来规避序号连贯问题。
   - 每一级嵌套必须使用 **4个空格** 进行缩进，确保层级分明。

3. **结构要求**：
   - 每个项目名使用 ### 标题。
   - 标题下先分块（如：功能开发、代码优化、问题修复），然后再列出具体事项。`;

    const prompt = `${templatePrompt}${customPrompt ? `\n附加要求：${customPrompt}` : ''}\n\n以下是来自多个项目的提交记录。请注意：在生成日志时，**必须为每个项目使用独立的二级或三级标题（如 ### 项目名）来突出显示**，并在此标题下汇总该项目的内容：\n${logs.map(l => `- [项目:${l.repoName}] ${l.date} [${l.author_name}]: ${l.message}`).join('\n')}`;

    try {
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                { 
                    role: 'system', 
                    content: '你是一个资深的软件项目经理，擅长将零散的 Git 提交记录转化为结构清晰、专业严谨的工作汇报。你会深入理解代码变动的意图，在不编造事实的前提下，用专业的行业术语进行润色和总结。你对 Markdown 格式要求极其严苛，尤其是列表的层级关系。' 
                },
                { role: 'user', content: prompt }
            ],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ content: response.data.choices[0].message.content });
    } catch (error) {
        console.error('AI 生成失败:', error.response?.data || error.message);
        res.status(500).json({ error: 'AI 生成日志失败，请检查 API 配置或网络' });
    }
});

// API: 获取所有模版
app.get('/api/templates', (req, res) => {
    res.json(templates);
});

app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});
