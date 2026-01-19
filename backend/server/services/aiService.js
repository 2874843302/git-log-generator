const axios = require('axios');
const { templates } = require('../constants/templates');

/**
 * 组装 AI Prompt 并调用 API 生成日志
 */
async function generateAILog(params) {
    const { logs, templateKey, customPrompt, tomorrowPlanPrompt, referenceLog, options, repoPaths, apiKey } = params;

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
        
        let mainTitle = `### ${periodText}完成工作（基于 Git 记录）`;
        if (isKpi) mainTitle = `### 核心业务价值产出`;
        
        const conciseSuffix = isConcise ? "（语言必须极度精简，每条不超过30字）" : "";

        if (options.includeProblems) {
            const problemTitle = isKpi ? "### 难点攻克与问题解决" : "### 遇到的问题及解决方法";
            requirements.push(`${problemTitle}\n请根据${periodText}完成工作的技术复杂度和代码变更，推断并描述在开发过程中实际可能遇到的技术难点或逻辑陷阱，并将其作为“自己遇到的问题”进行陈述，同时给出专业的解决方法。描述要真实、具体，避免空洞。${conciseSuffix}列表从 1. 开始计数。`);
        }
        if (options.includeReflections) {
            const reflectionTitle = isKpi ? "### 技术影响力与沉淀" : "### 心得收获与技术感悟";
            requirements.push(`${reflectionTitle}\n基于${periodText}的代码变动，总结深层的技术思考、架构优化的意义或开发过程中的经验教训。${conciseSuffix}列表从 1. 开始计数。`);
        }
        if (options.includeTomorrow) {
            const tomorrowTitle = isWeekly ? "### 下周计划" : (isKpi ? "### 后续规划与目标" : "### 明日计划");
            let tomorrowReq = `${tomorrowTitle}\n根据${periodText}工作进度，合理规划接下来的开发任务。${conciseSuffix}列表从 1. 开始计数。`;
            if (tomorrowPlanPrompt) {
                tomorrowReq += `\n**特别参考用户提供的计划关键词**：${tomorrowPlanPrompt}\n请基于这些关键词，结合${periodText}的工作内容，生成更具体、更丰富的计划描述。${conciseSuffix}`;
            }
            requirements.push(tomorrowReq);
        }
        
        if (requirements.length > 0) {
            templatePrompt += `\n请在生成的日志中，**严格按照以下顺序**包含这些板块：\n${mainTitle}\n汇总${periodText}代码变更及价值。${conciseSuffix}列表从 1. 开始计数。\n${requirements.join('\n')}`;
        } else {
            templatePrompt += `\n请仅在 ${mainTitle} 标题下对内容进行分类汇总，**禁止**出现${isWeekly ? '下周计划' : '明日计划'}、心得感悟或问题总结等其他板块。${conciseSuffix}`;
        }
    }

    templatePrompt += `\n\n**严格遵循以下规范**：
1. **内容深度与润色**：
   - **核心任务**：你不仅要看提交信息，更要${options?.includeDiffContent ? '**深度解析提供的代码差分 (diffContent)**' : '结合文件变更统计 (diffStat)'}。
   - **描述原则（强制执行）**：
     - **禁止套话**：严禁使用“为后续实现XXX奠定了基础”、“为XXX提供了支撑”、“为XXX创造了条件”等铺垫式套话。
     - **纯技术描述**：只描述当前逻辑的具体作用、执行流程、技术细节。
   - **分析细节**：
     ${options?.includeDiffContent ? '- 分析 diff 中的新函数定义、逻辑判断变动以及 API 接口的修改。' : '- 根据文件变更统计，分析哪些模块变动较大。'}
     - 使用如“优化了核心算法”、“修正了临界状态下的并发问题”、“重构了 UI 组件以提升复用性”等具体且专业的描述。
   - **严禁编造**：所有描述必须基于提供的代码变更。如果代码量很大被省略了，请结合文件统计 (diffStat) 进行合理推断，但不要脱离事实。

2. **列表编号规则（极其重要，强制执行）**：
   - **板块独立计数**：每个大板块（如 ### 今日完成工作、### 遇到的问题）下的列表必须**重新从 1. 开始计数**。
   - **严禁连续计数**：绝对不允许“今日完成工作”排到 5. 之后，“遇到的问题”接着从 6. 开始计数。
   - **多级嵌套**：父级使用有序列表（1. 2. 3.）。子级建议使用无序列表（ - ）以确保 Markdown 渲染的稳定性，且必须使用 **4个空格** 进行缩进。

3. **结构要求**：
   - 使用 ### 作为板块标题。
   - 在 ### 今日完成工作 下，可以按项目（如 **项目A**）或任务类型进行二次分类。`;

    const prompt = `${templatePrompt}${customPrompt ? `\n附加要求：${customPrompt}` : ''}\n\n以下是来自多个项目的提交记录详情。请注意：在生成日志时，**必须为每个项目使用独立的二级或三级标题（如 ### 项目名）来突出显示**，并在此标题下汇总该项目的内容：\n${logs.map(l => `- [项目:${l.repoName}] ${l.date} [${l.author_name}]: ${l.message}\n  [变更统计]: ${l.diffStat || '未开启'}\n  ${l.diffContent ? `[代码详情]:\n  ${l.diffContent}` : ''}`).join('\n')}`;

    // 3. 调用 API
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: 'deepseek-chat',
        messages: [
            { 
                role: 'system', 
                content: '你是一个资深的软件项目经理，擅长将零散的 Git 提交记录转化为结构清晰、专业严谨的工作汇报。你会深入理解代码变动的意图，在不编造事实的前提下，用专业的行业术语进行润色和总结。你对 Markdown 格式要求极其严苛，尤其是列表的层级关系。**请注意：直接输出报告的 Markdown 内容，不要包含任何如“好的”、“这是为您生成的报告”之类的开场白、寒暄或总结性陈述。**' 
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

    return response.data.choices[0].message.content;
}

module.exports = {
    generateAILog
};
