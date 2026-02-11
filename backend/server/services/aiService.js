const { templates } = require('../constants/templates');

/**
 * 组装 AI Prompt 并调用 API 生成日志
 */
async function generateAILog(params) {
    const { logs, templateKey, customPrompt, tomorrowPlanPrompt, referenceLog, options, repoPaths } = params;
    // 优先使用传入的 apiKey，否则从环境变量获取
    const apiKey = params.apiKey || process.env.DEEPSEEK_API_KEY;
    let titleTemplate = params.titleTemplate || process.env.TITLE_TEMPLATE;

    // 处理标题日期：如果包含日期占位符，取提交记录中的日期
    if (titleTemplate && (titleTemplate.includes('YYYY') || titleTemplate.includes('MM') || titleTemplate.includes('DD'))) {
        const targetDate = params.targetDate || (logs && logs.length > 0 ? logs[0].date.split(' ')[0] : new Date().toISOString().split('T')[0]);
        const dateObj = new Date(targetDate);
        if (!isNaN(dateObj.getTime())) {
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            titleTemplate = titleTemplate
                .replace(/YYYY/g, yyyy)
                .replace(/MM/g, mm)
                .replace(/DD/g, dd);
        }
    }

    if (!apiKey) {
        throw new Error('未检测到 DeepSeek API Key，请在设置中配置后再试');
    }

    // 1. Prompt 基础模版
    let templatePrompt = '';
    
    if (templateKey === 'custom' && referenceLog) {
        templatePrompt = `作为一名专业的软件项目经理，请根据提供的 Git 提交记录生成一份工作日志。
**特别要求**：你必须严格模仿以下【参考日志】的**语言风格、排版格式、语气以及内容的深度**。

【参考日志开始】
${referenceLog}
【参考日志结束】

请确保生成的日志在视觉结构和叙事方式上与上述参考内容保持高度一致。`;
    } else {
        templatePrompt = templates[templateKey] || templates.daily;
    }

    // 2. 根据选项添加要求 (仅在非自定义模式下强制注入板块，或者作为补充)
    if (options && templateKey !== 'custom') {
        const requirements = [];
        const isWeekly = templateKey === 'weekly';
        const isConcise = templateKey === 'concise';
        const isKpi = templateKey === 'kpi';
        const periodText = isWeekly ? "本周" : (isKpi ? "考核期内" : "今日");
        
        const hasLogs = logs && logs.length > 0;
        
        let mainTitle = hasLogs ? `### ${periodText}完成工作` : "";
        if (hasLogs && isKpi) mainTitle = `### 核心业务价值产出`;
        
        const conciseSuffix = isConcise ? "（语言必须极度精简，每条不超过30字）" : "";

        if (options.includeProblems && hasLogs) {
            const problemTitle = isKpi ? "### 难点攻克与问题解决" : "### 遇到的问题及解决方法";
            requirements.push(`${problemTitle}\n请根据${periodText}完成工作的技术复杂度和代码变更，推断并描述在开发过程中实际可能遇到的技术难点或逻辑陷阱，并将其作为“自己遇到的问题”进行陈述，同时给出专业的解决方法。描述要真实、具体，避免空洞。${conciseSuffix}列表从 1. 开始计数。`);
        }
        if (options.includeReflections && hasLogs) {
            const reflectionTitle = isKpi ? "### 技术影响力与沉淀" : "### 心得收获与技术感悟";
            requirements.push(`${reflectionTitle}\n基于${periodText}的代码变动，总结深层的技术思考、架构优化的意义或开发过程中的经验教训。${conciseSuffix}列表从 1. 开始计数。`);
        }
        if (options.includeTomorrow) {
            // 将“明日计划”改为动态总结的标题，并强化润色和连贯性要求
            const tomorrowTitle = isWeekly ? "### 下周计划" : (isKpi ? "### 后续规划与目标" : "### [动态标题]");
            let tomorrowReq = `${tomorrowTitle}\n根据${periodText}工作进度，合理规划接下来的开发任务或描述自学/Demo练习内容。
**写作要求**：
1. **动态标题总结**：不要使用固定的“补充内容”作为标题。请根据用户提供的素材或自学内容，总结出一个更具概括性的专业标题（例如：### 技术预研：React Native 架构、### 自学沉淀：Docker 容器化实践 等）。
2. **深度润色**：不要只是简单罗列，要将零碎的计划或学习点转化为逻辑连贯、具有专业性的描述。
3. **流程化叙述**：如果是自学或Demo开发，请描述其“补充流程”（如：从环境搭建到核心逻辑实现，再到测试验证的连贯过程）。
${conciseSuffix}列表从 1. 开始计数。`;
            if (tomorrowPlanPrompt) {
                tomorrowReq += `\n**用户提供的核心素材**：${tomorrowPlanPrompt}\n请以此素材为基础，按照上述“写作要求”进行深度扩充和连贯性描述。${conciseSuffix}`;
            }
            requirements.push(tomorrowReq);
        }
        
        if (requirements.length > 0) {
            // 如果没有日志，mainSection 为空，不会引导 AI 生成“今日工作”标题
            const mainSection = mainTitle ? `${mainTitle}\n汇总${periodText}代码变更及价值。${conciseSuffix}列表从 1. 开始计数。\n` : "";
            templatePrompt += `\n请在生成的日志中，**仅包含以下有内容的板块，严禁出现空标题或无意义的占位标题**：\n${mainSection}${requirements.join('\n')}`;
        } else if (mainTitle) {
            templatePrompt += `\n请仅在 ${mainTitle} 标题下对内容进行分类汇总，**禁止**出现${isWeekly ? '下周计划' : '补充内容'}、心得感悟或问题总结等其他板块。${conciseSuffix}`;
        }
    }

    // 3. 准备日志上下文
    const hasLogs = logs && logs.length > 0;
    const includeTomorrow = options?.includeTomorrow;
    
    let logContext = '';
    if (hasLogs) {
        logContext = `以下是来自多个项目的提交记录详情。请注意：在生成日志时，**必须为每个项目使用独立的二级或三级标题（如 ### 项目名）来突出显示**，并在此标题下汇总该项目的内容：\n${logs.map(l => `- [项目:${l.repoName}] ${l.date} [${l.author_name}]: ${l.message}\n  [变更统计]: ${l.diffStat || '未开启'}\n  ${l.diffContent ? `[代码详情]:\n  ${l.diffContent}` : ''}`).join('\n')}`;
    } else {
        if (includeTomorrow && tomorrowPlanPrompt) {
            logContext = "当前没有任何 Git 提交记录。请完全跳过“今日完成工作”等与代码提交相关的板块。请直接根据【补充内容】中的素材进行扩充和润色，生成一份连贯、专业的技术日志。";
        } else {
            logContext = "当前没有任何 Git 提交记录，且未提供任何补充素材。请生成一份简短的说明，表示今日无代码提交记录。";
        }
    }

    const prompt = `${templatePrompt}${customPrompt ? `\n附加要求：${customPrompt}` : ''}\n\n${logContext}

**严格遵循以下写作规范**：
1. **内容真实性（核心）**：
   - 如果没有 Git 提交记录，**严禁**生成“今日完成工作”、“遇到的问题”或“心得感悟”等标题，也不得编造项目名称。
   - 所有的描述必须基于提供的代码变更或补充内容素材。
2. **列表编号规则**：
   - 每个板块（### 标题）下的列表必须**独立从 1. 开始计数**。
   - 严禁跨板块连续计数。
3. **内容润色与深度**：
   - **核心任务**：不仅要汇总提交信息，更要${options?.includeDiffContent ? '**深度解析提供的代码差分 (diffContent)**' : '结合文件变更统计 (diffStat)'}。
   - **描述原则**：只描述当前逻辑的具体作用、执行流程、技术细节，严禁使用空洞的套话。
   - **禁止量化描述**：严禁出现“修改了 X 行代码”、“删除了 Y 行”等字眼，应转化为对逻辑变动意图的专业描述。
4. **格式要求**：
   - 使用 ### 作为板块标题。
   - 父级使用有序列表（1. 2. 3.），子级使用无序列表（ - ）并保持 4 个空格缩进。`;

    // 4. 调用 API
    try {
        console.log('正在调用 DeepSeek API...', { model: 'deepseek-chat', logCount: logs.length });
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { 
                        role: 'system', 
                        content: `你是一个资深的软件项目经理，擅长将零散的 Git 提交记录转化为结构清晰、专业严谨的工作汇报。你会深入理解代码变动的意图，在不编造事实的前提下，用专业的行业术语进行润色和总结。你对 Markdown 格式要求极其严苛，尤其是列表的层级关系。

**核心约束（强制执行）**：
1. **标题规范**：严禁使用“明日计划”或“补充内容”作为固定标题。必须根据内容动态总结 ### [专业标题]。
2. **无素材不标题**：如果没有 Git 提交记录，严禁出现“今日工作”等标题；如果没有遇到问题，严禁出现“遇到问题”等标题。
3. **内容润色与描述规范**：
   - 对于用户提供的素材，禁止生硬罗列。你必须进行二次创作，将其描述为一套连贯的学习或开发流程（如：研究方案 -> 实践编码 -> 总结验证）。
   - **禁止出现量化描述**：严禁在日志中提及“修改了几行代码”、“删除了几行”、“新增了多少行”等具体行数描述。
   - **深度技术表达**：应侧重于描述逻辑变更的意图、重构的影响、解决的具体 Bug 场景或新增功能的技术栈实现。
4. **直接输出**：直接输出报告的 Markdown 内容，不要包含任何开场白或总结。
5. **消除冗余**：严禁出现“基于 Git 记录”、“根据提交信息”等说明性文字。` 
                    },
                    { role: 'user', content: prompt }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            console.error('DeepSeek API 响应错误:', response.status, response.statusText);
            let errorMsg = `HTTP Error ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error?.message || errorMsg;
            } catch (e) {
                try {
                    const text = await response.text();
                    errorMsg = text.substring(0, 100) || errorMsg;
                } catch (e2) {}
            }
            throw new Error(`AI 服务调用失败: ${errorMsg}`);
        }

        const data = await response.json();
        console.log('DeepSeek API 原始响应:', JSON.stringify(data, null, 2));
        
        if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
            console.error('AI 响应结构异常:', data);
            throw new Error('AI 返回数据格式错误，请检查 API 状态');
        }

        const content = data.choices[0].message.content;
        console.log('AI 生成成功，内容长度:', content?.length);
        return { content: content || '' };
    } catch (error) {
        console.error('AI Service 捕获到异常:', error);
        throw error;
    }
}

/**
 * 聊天助手：小飞
 */
async function chatWithAssistant(params) {
    const { messages, apiKey: userApiKey } = params;
    const apiKey = userApiKey || process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
        throw new Error('未检测到 DeepSeek API Key，请在设置中配置后再试');
    }

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { 
                        role: 'system', 
                        content: `你是“小飞”，一个集成在 Git 工作日志自动生成工具中的 AI 助手。
你的主要职责是：
1. 辅助用户使用该应用（解答关于 Git 提交、日志生成、学习通同步等功能的问题）。
2. 提供专业的技术建议和日志润色建议。
3. 保持友好、专业、简洁的沟通风格。

应用核心功能点：
- Git 日志检索：支持多仓库、多作者、日期范围筛选。
- AI 日志生成：支持多种模版（简洁、详细、KPI、周报、自定义）。
- 学习通同步：一键将生成的 Markdown 内容同步到学习通笔记，支持静默模式和浏览器模式。
- 分段生成：支持将工作内容分割到不同日期（如昨日和今日）并分别同步。
- 傻瓜模式：一键完成检索、生成和同步。
- 一键补全：自动检查缺失日志并根据 Git 记录补全。

你可以通过调用工具来直接帮助用户执行操作。如果用户表达了想要检查日志、补全日志、分段同步等意图，请主动调用相应的工具。` 
                    },
                    ...messages
                ],
                tools: [
                    {
                        type: "function",
                        function: {
                            name: "check_logs",
                            description: "检查学习通上的工作日志提交情况，识别哪些日期漏报了。",
                            parameters: {
                                type: "object",
                                properties: {},
                                required: []
                            }
                        }
                    },
                    {
                        type: "function",
                        function: {
                            name: "auto_fill_logs",
                            description: "自动补全缺失的工作日志并同步到学习通。",
                            parameters: {
                                type: "object",
                                properties: {
                                    mode: {
                                        type: "string",
                                        enum: ["daily", "average"],
                                        description: "补全模式：'daily' 表示按天匹配提交记录，'average' 表示将所有提交平均分配到缺失日期。"
                                    }
                                },
                                required: ["mode"]
                            }
                        }
                    },
                    {
                        type: "function",
                        function: {
                            name: "split_generate_and_sync",
                            description: "将当前的 Git 提交记录分段生成为两天的日志并同步到学习通。",
                            parameters: {
                                type: "object",
                                properties: {
                                    offset1: {
                                        type: "number",
                                        description: "第一部分日志的日期偏移（天），例如 1 代表昨天。"
                                    },
                                    offset2: {
                                        type: "number",
                                        description: "第二部分日志的日期偏移（天），例如 0 代表今天。"
                                    }
                                },
                                required: ["offset1", "offset2"]
                            }
                        }
                    }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`AI 服务调用失败: ${response.status}`);
        }

        const data = await response.json();
        const message = data.choices[0].message;
        
        return { 
            content: message.content || '',
            tool_calls: message.tool_calls || null
        };
    } catch (error) {
        console.error('Chat Assistant Error:', error);
        throw error;
    }
}

module.exports = {
    generateAILog,
    chatWithAssistant
};
