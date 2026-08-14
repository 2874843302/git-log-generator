const { templates } = require('../constants/templates');

/**
 * DeepSeek V4 可选模型列表
 * - deepseek-v4-flash: 快速、低成本（适合日常日志生成）
 * - deepseek-v4-pro: 高质量、高成本（适合复杂分析/述职等场景）
 */
const DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'];
const DEFAULT_MODEL = 'deepseek-v4-flash';

/**
 * daily 模版输出格式兜底归一化（不依赖模型自觉）：
 * 1. 去除空行与 Markdown 标题/列表/加粗标记；
 * 2. 组标题统一重编号为“N. 项目名: 状态--Xh”；
 * 3. 八小时制兜底：合计不足/超出 8h 时在最后一组补齐差值；
 * 4. 每行之间空一行，确保 Markdown 渲染后各自独立成段。
 */
function normalizeDailyLog(content, includeHours = true) {
    if (!content) return content;
    const headerRe = /^(?:\d+\s*[.、．]\s*)?(.+?)\s*[:：]\s*(已完成|进行中)(?:\s*-{1,2}\s*(\d+)\s*h)?$/;
    const lines = content
        .split(/\r?\n/)
        // 行内粘连拆分：在“类别:”或“组标题(状态--Xh)”边界处强制换行
        // 注意：(?<![.、．]) 保护组标题内部“N. 项目名”之间的空格不被切断
        .flatMap((l) => l
            .replace(/[ \t]+(?=(?:功能优化|需求处理|定制处理|问题处理|配置处理|pm处理|临时工作)[:：])/g, '\n')
            .replace(/(?<![.、．])[ \t]+(?=(?:\d+[.、．]\s*)?[\u4e00-\u9fa5A-Za-z0-9_-]+[:：]\s*(?:已完成|进行中)(?:\s*-{1,2}\s*\d+h)?)/g, '\n')
            .split('\n'))
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => l
            .replace(/^#{1,6}\s+/, '')
            .replace(/^[-*+]\s+/, '')
            .replace(/^\*\*(.+)\*\*$/, '$1'));

    // 组标题重编号并提取耗时
    let counter = 0;
    const parsed = lines.map((l) => {
        const m = l.match(headerRe);
        if (!m) return { text: l, header: false };
        counter += 1;
        return { header: true, name: m[1], status: m[2], hours: m[3] ? parseInt(m[3], 10) : 0, no: counter };
    });

    // 八小时制兜底：合计不等于 8 时调整最后一组（仅在开启时间分配时）
    const headers = parsed.filter((p) => p.header);
    if (includeHours && headers.length > 0) {
        const total = headers.reduce((s, p) => s + p.hours, 0);
        if (total !== 8) {
            const last = headers[headers.length - 1];
            const fixed = last.hours + (8 - total);
            if (fixed >= 1) last.hours = fixed;
        }
    }

    return parsed
        // 组标题编号转义为“N\.”，避免被 Markdown/编辑器解析为有序列表导致序号错乱
        .map((p) => {
            if (!p.header) return p.text;
            return includeHours
                ? `${p.no}\\. ${p.name}: ${p.status}--${p.hours}h`
                : `${p.no}\\. ${p.name}: ${p.status}`;
        })
        .join('\n\n');
}

/**
 * 组装 AI Prompt 并调用 API 生成日志
 */
async function generateAILog(params) {
    const { logs, templateKey, customPrompt, tomorrowPlanPrompt, referenceLog, options, repoPaths } = params;
    // 优先使用传入的 apiKey，否则从环境变量获取
    const apiKey = params.apiKey || process.env.DEEPSEEK_API_KEY;
    // 模型选择：优先使用传入的 model，其次从环境变量读取，最后使用默认值
    const model = params.model || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
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

    // 全局开关：开启旧版日报格式时，daily 走经典 Markdown 模版与通用板块逻辑
    // 优先使用前端随请求传递的开关状态，环境变量作为兜底
    const classicMode = templateKey === 'daily' && (
        params.classicMode === true ||
        process.env.DAILY_CLASSIC_MODE === 'true' ||
        process.env.DAILY_CLASSIC_MODE === true
    );
    if (classicMode) {
        templatePrompt = templates.dailyClassic;
    }

    // 2. 根据选项添加要求 (仅在非自定义模式下强制注入板块，或者作为补充)
    // daily 模版采用公司规范的分条格式，板块由模版自身控制，跳过通用 ### 板块注入
    const isDaily = templateKey === 'daily' && !classicMode;
    // 全局配置：日志是否显示时间分配（--Xh 与 8 小时制）
    const includeHours = !(process.env.DAILY_INCLUDE_HOURS === 'false' || process.env.DAILY_INCLUDE_HOURS === false);
    if (options && templateKey !== 'custom' && !isDaily) {
        const requirements = [];
        const isWeekly = templateKey === 'weekly';
        const isConcise = templateKey === 'concise';
        const isKpi = templateKey === 'kpi';
        const isBriefing = templateKey === 'briefing';
        const periodText = isWeekly ? "本周" : (isKpi ? "考核期内" : "今日");
        
        const hasLogs = logs && logs.length > 0;
        
        let mainTitle = hasLogs ? `### ${periodText}完成工作` : "";
        if (hasLogs && isKpi) mainTitle = `### 核心业务价值产出`;
        if (hasLogs && isBriefing) mainTitle = `### 业务目标与达成情况`;
        
        const conciseSuffix = isConcise ? "（语言必须极度精简，每条不超过30字）" : "";

        if (options.includeProblems && hasLogs) {
            const problemTitle = isKpi ? "### 难点攻克与问题解决" : (isBriefing ? "### 风险/问题与处理" : "### 遇到的问题及解决方法");
            requirements.push(
                isBriefing
                    ? `${problemTitle}\n请从项目推进与业务落地视角总结关键风险/问题，说明影响范围、你采取的应对动作、当前状态与后续预案，避免空泛技术术语堆砌。列表从 1. 开始计数。`
                    : `${problemTitle}\n请根据${periodText}完成工作的技术复杂度和代码变更，推断并描述在开发过程中实际可能遇到的技术难点或逻辑陷阱，并将其作为“自己遇到的问题”进行陈述，同时给出专业的解决方法。描述要真实、具体，避免空洞。${conciseSuffix}列表从 1. 开始计数。`
            );
        }
        if (options.includeReflections && hasLogs) {
            const reflectionTitle = isKpi ? "### 技术影响力与沉淀" : (isBriefing ? "### 本人负责与关键贡献" : "### 心得收获与技术感悟");
            requirements.push(
                isBriefing
                    ? `${reflectionTitle}\n围绕“我负责/我主导/我推进”进行总结，说明个人责任边界、关键动作、达成结果与可复用经验，突出业务价值贡献。列表从 1. 开始计数。`
                    : `${reflectionTitle}\n基于${periodText}的代码变动，总结深层的技术思考、架构优化的意义或开发过程中的经验教训。${conciseSuffix}列表从 1. 开始计数。`
            );
        }
        if (options.includeTomorrow) {
            // 将“明日计划”改为动态总结的标题，并强化润色和连贯性要求
            const tomorrowTitle = isBriefing
                ? "### 下一阶段计划与资源诉求"
                : (isWeekly ? "### 下周计划" : (isKpi ? "### 后续规划与目标" : "### [动态标题]"));
            let tomorrowReq = isBriefing
                ? `${tomorrowTitle}\n请按“下一阶段业务目标、关键里程碑、主要风险、需要的协同或资源支持”进行总结，表达务实、可执行。`
                : `${tomorrowTitle}\n根据${periodText}工作进度，合理规划接下来的开发任务或描述自学/Demo练习内容。
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
            const mainSection = mainTitle ? `${mainTitle}\n汇总${periodText}代码变更及价值；**相同功能的描述须合并为一项**，勿按每条提交单独成条。${conciseSuffix}列表从 1. 开始计数。\n` : "";
            templatePrompt += `\n请在生成的日志中，**仅包含以下有内容的板块，严禁出现空标题或无意义的占位标题**：\n${mainSection}${requirements.join('\n')}`;
        } else if (mainTitle) {
            templatePrompt += `\n请仅在 ${mainTitle} 标题下对内容进行分类汇总，**相同功能合并描述**；**禁止**出现${isWeekly ? '下周计划' : '补充内容'}、心得感悟或问题总结等其他板块。${conciseSuffix}`;
        }
    }

    // daily 模版：用户补充的非代码素材（会议、临时事务等）归入“临时工作”组
    if (isDaily && tomorrowPlanPrompt) {
        templatePrompt += `\n**用户提供的非代码类补充素材（归入“临时工作”组）**：${tomorrowPlanPrompt}`;
    }

    // daily 模版：关闭时间分配时，覆盖结构/示例中关于耗时的描述
    if (isDaily && !includeHours) {
        templatePrompt += `\n**特别要求（用户全局设置：不显示时间分配）**：组标题不含耗时，格式为“N. 项目名: 状态”；上述结构与示例中任何关于 --Xh 耗时、8 小时合计的描述均不遵循。`;
    }

    // 3. 准备日志上下文
    const hasLogs = logs && logs.length > 0;
    const includeTomorrow = options?.includeTomorrow;
    
    // 获取项目别名配置 (JSON 格式: { "repo-name": "中文别名" })
    const repoAliases = params.repoAliases || {};
    
    let logContext = '';
    if (hasLogs) {
        const aliasTable = Object.entries(repoAliases).map(([name, alias]) => `- 原始名: ${name} -> 中文别名: ${alias}`).join('\n');
        const logDetails = logs.map(l => {
            const displayName = repoAliases[l.repoName] || l.repoName;
            return `- [项目:${displayName}] ${l.date} [${l.author_name}]: ${l.message}\n  [变更统计]: ${l.diffStat || '未开启'}\n  ${l.diffContent ? `[代码详情]:\n  ${l.diffContent}` : ''}`;
        }).join('\n');
        logContext = isDaily
            ? `以下是来自多个项目的提交记录详情。请按项目分组生成编号组；组标题的项目名**必须**使用中文别名（如有），严禁使用原始项目名；同一项目内相同功能或同一问题的多次提交合并为一条工作条目。

项目别名对照表：
${aliasTable}

提交记录详情：\n${logDetails}`
            : `以下是来自多个项目的提交记录详情。请注意：在生成日志时，**必须为每个项目使用独立的二级或三级标题（如 ### 项目名）来突出显示**，并在此标题下汇总该项目的内容。
**强制要求**：如果项目有中文别名（如下表所示），你**必须**使用该中文别名作为项目的标题，严禁使用原始项目名。

项目别名对照表：
${aliasTable}

提交记录详情：\n${logDetails}`;
    } else {
        if (includeTomorrow && tomorrowPlanPrompt) {
            logContext = isDaily
                ? "当前没有任何 Git 提交记录。请跳过项目分组，仅根据补充素材生成“临时工作”组。"
                : "当前没有任何 Git 提交记录。请完全跳过“今日完成工作”等与代码提交相关的板块。请直接根据【补充内容】中的素材进行扩充和润色，生成一份连贯、专业的技术日志。";
        } else {
            logContext = isDaily
                ? "当前没有任何 Git 提交记录，且未提供任何补充素材。请仅输出一行：今日无工作日志内容。"
                : "当前没有任何 Git 提交记录，且未提供任何补充素材。请生成一份简短的说明，表示今日无代码提交记录。";
        }
    }

    const dailyRules = `

**严格遵循以下写作规范**：
1. **内容真实性（核心）**：所有描述必须基于提供的提交记录或补充素材，严禁编造项目、事项或进度。
2. **只输出日志正文**：严禁出现 ### 标题、加粗、缩进、开场白、总结语；严禁出现“Git”、“提交记录”、“基于以上”等字眼。
3. **同类合并**：同一功能、同一模块或同一问题的多次提交合并为一条工作条目，禁止按提交条数机械拆分。
4. **客观简短**：每条一句话陈述实际工作事项；禁止提及文件名、函数名、代码行数；禁止“提升了性能”、“增强了稳定性”等空泛评价。
5. 所有行顶格输出，组标题序号从 1. 开始连续编号。
${includeHours ? '6. **八小时制（强制）**：所有组标题耗时（--Xh，含“临时工作”组）合计必须恰好等于 8h，不得多也不得少。\n' : ''}7. **独立成行（强制）**：组标题行与每条工作条目行之间必须空一行，渲染后耗时与工作描述不得出现在同一行。
8. **内容不足时**：提交较少时把真实工作按开发流程展开（需求梳理、方案设计、编码、自测修复、联调验收、文档整理）成多条条目；仍不足补 1-2 条“学习了XXXX”的 AI 前沿学习项（自行选取当前前沿方向，如 Agent 编排/RAG/多模态/AI 编码协作/提示词工程/轻量微调等），再不足补会议/环境维护等例行项；严禁虚构不存在的项目或业务。
9. **多样化（强制）**：禁止一件事占满全天；单个组耗时超过 4h 时组内至少拆出 3 条不同工作条目。`;

    const genericRules = `

**严格遵循以下写作规范**：
1. **内容真实性（核心）**：
   - 如果没有 Git 提交记录，**严禁**生成“今日完成工作”、“遇到的问题”或“心得感悟”等标题，也不得编造项目名称。
   - 所有的描述必须基于提供的代码变更或补充内容素材。
2. **列表编号规则**：
   - 每个板块（### 标题）下的列表必须**独立从 1. 开始计数**。
   - 严禁跨板块连续计数。
3. **内容润色与描述原则**：
   - **去除“AI 味”与固定句式**：严禁使用“完成了xxx，以xxx”、“通过xxx，实现了xxx”等修饰性句式。**只陈述客观事实**，直接描述功能实现，不使用多余的连接词或总结性评价。
   - **宏观功能总结（核心）**：
     - **禁止提及具体文件**：描述中严禁出现文件路径、文件名或函数名（如：修改了 \`utils.js\` 中的 \`format\` 函数）。
     - **禁止描述低级代码改动**：严禁描述具体的代码行操作（如：添加了 if 判断、修改了变量名、删除了某行代码）。
     - **功能导向描述**：必须将代码层面的改动抽象为**功能逻辑的变更**。例如，不要说“在 login 函数增加了验证”，而应说“完善了用户登录阶段的安全校验逻辑”。
   - **同类功能归并（核心）**：
     - 若多条提交或代码 diff 指向**同一业务功能、同一模块、同一用户场景或同一目标**（例如多次 commit 都在完善同一接口、同一流程或同一 bug 修复闭环），必须**合并为一条**概括性描述，**禁止**按提交条数或 diff 条数机械拆成多条并列要点。
     - 仅在**实质不同的功能/模块/目标**之间才拆成多项；合并后的表述应体现工作量的整体面貌，而不是逐项复述。
   - **禁止量化与意义描述**：
     - 严禁描述“涉及了多少个文件”、“修改了多少行代码”。
     - 严禁在深度分析中提及“提升了性能”、“增强了稳定性”等定性意义描述。
4. **格式要求**：
   - 使用 ### 作为板块标题。
   - 父级使用有序列表（1. 2. 3.），子级使用无序列表（ - ）且**严禁使用任何缩进**，所有列表项必须顶格。`;

    const prompt = `${templatePrompt}${customPrompt ? `\n附加要求：${customPrompt}` : ''}\n\n${logContext}${isDaily ? dailyRules : genericRules}`;

    const businessFirstPrompt = templateKey === 'briefing'
        ? `\n\n**述职补充约束（面向领导，强制）**：
1. 默认读者不懂技术，必须用业务语言表达“我负责什么 -> 我做了什么 -> 带来什么结果”。
2. 强调个人责任边界与关键交付，优先使用“我负责/我主导/我推进/我落地”。
3. 必须单独写“给公司带来的价值”板块，至少包含 2 条，不得缺失。
4. 公司价值可从收入机会、成本/人效、风险控制、客户体验、组织协同中选择表达，禁止空话套话。
5. 每个项目先写目标，再写动作，再写结果，并补充该项目对公司的价值影响。
6. 禁止写代码实现细节；结尾必须给出下一阶段计划与资源诉求（如跨团队配合、排期、依赖支持）。`
        : '';

    // 4. 调用 API（DeepSeek V4）
    try {
        console.log('正在调用 DeepSeek V4 API...', { model, logCount: logs.length });
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                // 日志生成是文本变换任务，关闭 thinking 以提升速度、降低成本
                thinking: { type: 'disabled' },
                messages: [
                    { 
                        role: 'system', 
                        content: isDaily ? `你是一个严谨的软件工程师，擅长把零散的 Git 提交记录转化为分条、清晰、完整全面的工作日志，让人一眼看出当日工作内容及完成进度。直接输出日志正文，不包含任何开场白、解释、Markdown 标题或加粗。` : `你是一个资深的软件项目经理，擅长将零散的 Git 提交记录转化为结构清晰、专业严谨的工作汇报。你会深入理解代码变动的意图，在不编造事实的前提下完成总结。你对 Markdown 格式要求极其严苛，尤其是列表的层级关系。

**核心约束（强制执行）**：
1. **标题规范**：严禁使用"明日计划"或"补充内容"作为固定标题。必须根据内容动态总结 ### [专业标题]。
2. **无素材不标题**：如果没有 Git 提交记录，严禁出现"今日工作"等标题；如果没有遇到问题，严禁出现"遇到问题"等标题。
3. **内容润色与描述规范**：
   - **陈述事实，去除"AI味"**：严禁使用"完成了...，以..."、"通过...，实现了..."等固定句式。禁止使用任何总结性、修饰性、赞美性的词汇。**必须直接、客观地陈述功能实现**。
   - **宏观化描述**：
     - **禁止提及文件名与函数名**：严禁在描述中指明具体的文件路径或代码位置。
     - **禁止描述低层级代码改动**：严禁提及具体的代码实现细节（如：修改了某行、增加了某个判断）。
     - **功能逻辑导向**：应将代码变动总结为对功能模块的影响或业务逻辑的实现方式。
   - **同类功能必须合并**：同一功能、同一模块或同一目标下的多处变更只能写**一条**汇总描述，禁止拆成多项并列；只有不同功能目标才可分列。
   - **禁止伪量化**：严禁编造文件数量、代码行数、性能指标等虚假数据；若无明确数据可用"效率提升、流程更顺畅、风险可控"等定性业务结果表达。
   - 对于用户提供的素材，进行专业化的润色，但严禁生硬罗列。将其描述为连贯的技术开发流程。
4. **述职场景附加规则（当用户选择述职模板时）**：
   - 默认读者是管理者而非技术同学，优先使用业务语言，不使用代码术语堆砌。
   - 重点回答三件事：你负责什么、你做成了什么、对业务有什么价值。
   - 必须额外回答第四件事：给公司带来了什么价值，并单独成段或成标题展示。
   - 允许并鼓励描述业务价值和管理价值，不要只写"做了哪些开发动作"。
5. **格式规范（强制）**：
   - 直接输出 Markdown 内容，不要包含任何开场白或总结。
   - 严禁出现"基于 Git 记录"等说明性文字。
   - **所有列表项（有序或无序）必须左侧顶格，严禁使用任何空格或缩进**。` 
                    },
                    { role: 'user', content: `${prompt}${businessFirstPrompt}` }
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
        // daily 模版做格式兜底归一化（编号/空行/8小时制），其余模版原样返回
        return { content: isDaily ? normalizeDailyLog(content, includeHours) : (content || '') };
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
    const model = params.model || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;

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
                model,
                // 聊天助手开启 thinking 模式以提升工具调用准确性
                thinking: { type: 'enabled' },
                reasoning_effort: 'high',
                messages: [
                    { 
                        role: 'system', 
                        content: `你是"小飞"，一个集成在 Git 工作日志自动生成工具中的 AI 助手。
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
            tool_calls: message.tool_calls || null,
            // V4 thinking 模式下返回 reasoning_content，前端可用于展示思考过程
            reasoning_content: message.reasoning_content || null
        };
    } catch (error) {
        console.error('Chat Assistant Error:', error);
        throw error;
    }
}

/**
 * 查询 DeepSeek 账户余额与用量统计
 */
async function getApiUsageStats(params = {}) {
    const apiKey = params.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        throw new Error('未检测到 DeepSeek API Key，请先在设置中保存');
    }

    const response = await fetch('https://api.deepseek.com/user/balance', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        let errorMsg = `HTTP Error ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error?.message || errorMsg;
        } catch (e) {
            // ignore json parse error
        }
        throw new Error(`查询余额失败: ${errorMsg}`);
    }

    const data = await response.json();
    const balanceInfos = Array.isArray(data?.balance_infos) ? data.balance_infos : [];

    const statsByCurrency = balanceInfos.map((item) => {
        const granted = Number(item.granted_balance || 0);
        const toppedUp = Number(item.topped_up_balance || 0);
        const total = Number((granted + toppedUp).toFixed(4));
        const remaining = Number(item.total_balance || 0);
        const used = Number(Math.max(0, total - remaining).toFixed(4));

        return {
            currency: item.currency || 'CNY',
            total,
            remaining,
            used,
            granted,
            toppedUp
        };
    });

    return {
        isAvailable: Boolean(data?.is_available),
        updatedAt: new Date().toISOString(),
        statsByCurrency
    };
}

module.exports = {
    generateAILog,
    chatWithAssistant,
    getApiUsageStats,
    DEEPSEEK_MODELS,
    DEFAULT_MODEL
};
